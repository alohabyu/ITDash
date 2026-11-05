import "server-only";
import { cacheLife } from "next/cache";

import type { Storage } from "@/lib/data/types";
import { attempt, env, envList, fetchJson, type Result, SourceError, stripTrailingSlash } from "./http";

/**
 * Zabbix JSON-RPC adapter (tested shape: Zabbix 6.4 / 7.x).
 *
 * Env:
 *   ZABBIX_URL              https://zabbix.example.local   (without /api_jsonrpc.php)
 *   ZABBIX_TOKEN            API token of a read-only user
 *   ZABBIX_HOSTGROUP_IDS    optional, comma-separated group ids to limit what's shown
 *   ZABBIX_STORAGE_MIN_TB   optional, only show filesystems at least this big (default 1)
 */

export function zabbixConfigured() {
  return Boolean(env("ZABBIX_URL") && env("ZABBIX_TOKEN"));
}

type RpcResponse<T> = { result?: T; error?: { code: number; message: string; data?: string } };

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const url = `${stripTrailingSlash(env("ZABBIX_URL"))}/api_jsonrpc.php`;
  const body = await fetchJson<RpcResponse<T>>("zabbix", url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json-rpc",
      // Zabbix 6.4+; the old `auth` body field was removed in 7.2
      Authorization: `Bearer ${env("ZABBIX_TOKEN")}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  if (body.error) {
    throw new SourceError("zabbix", `${method}: ${body.error.data || body.error.message}`);
  }
  return body.result as T;
}

function groupFilter() {
  const ids = envList("ZABBIX_HOSTGROUP_IDS");
  return ids.length ? { groupids: ids } : {};
}

// ---------- hosts ----------

type ZHost = { hostid: string; name: string; interfaces: { available: string }[] };

export type HostSummary = { total: number; up: number; unreachable: string[] };

/** Monitored hosts; a host is "unreachable" if any of its interfaces is unavailable (2). */
async function fetchZabbixHosts(): Promise<HostSummary> {
  const hosts = await rpc<ZHost[]>("host.get", {
    output: ["hostid", "name"],
    filter: { status: 0 },
    selectInterfaces: ["available"],
    ...groupFilter(),
  });
  const unreachable = hosts
    .filter((h) => h.interfaces.some((i) => i.available === "2"))
    .map((h) => h.name);
  return { total: hosts.length, up: hosts.length - unreachable.length, unreachable };
}

// ---------- problems ----------

type ZProblem = {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  suppressed?: string;
};
type ZEvent = { eventid: string; hosts: { name: string }[] };

export type Problem = {
  id: string;
  name: string;
  /** 0 not classified · 1 info · 2 warning · 3 average · 4 high · 5 disaster */
  severity: number;
  /** epoch ms */
  since: number;
  host: string;
};

/** Currently open problems, newest first, with the host name attached. */
async function fetchZabbixProblems(): Promise<Problem[]> {
  const problems = await rpc<ZProblem[]>("problem.get", {
    output: ["eventid", "name", "severity", "clock", "suppressed"],
    sortfield: ["eventid"],
    sortorder: "DESC",
    limit: 100,
    ...groupFilter(),
  });
  const visible = problems.filter((p) => p.suppressed !== "1");
  if (!visible.length) return [];

  const events = await rpc<ZEvent[]>("event.get", {
    eventids: visible.map((p) => p.eventid),
    output: ["eventid"],
    selectHosts: ["name"],
  });
  const hostByEvent = new Map(events.map((e) => [e.eventid, e.hosts.map((h) => h.name).join(", ")]));

  return visible.map((p) => ({
    id: p.eventid,
    name: p.name,
    severity: Number(p.severity),
    since: Number(p.clock) * 1000,
    host: hostByEvent.get(p.eventid) ?? "—",
  }));
}

// ---------- storage ----------

type ZItem = { itemid: string; key_: string; lastvalue: string; hosts: { name: string }[] };

// matches both  vfs.fs.size[/data,used]  and  vfs.fs.dependent.size[/data,total]  (LLD templates)
const FS_KEY = /^vfs\.fs(?:\.dependent)?\.size\[(.+),(used|total)\]$/;
const TB = 1024 ** 4;

/** Largest/fullest filesystems, using the used + total items from the standard OS templates. */
async function fetchZabbixStorage(limit = 4): Promise<Storage[]> {
  const items = await rpc<ZItem[]>("item.get", {
    output: ["itemid", "key_", "lastvalue"],
    selectHosts: ["name"],
    search: { key_: "vfs.fs" },
    monitored: true,
    ...groupFilter(),
  });

  const fs = new Map<string, { name: string; used?: number; total?: number }>();
  for (const it of items) {
    const m = FS_KEY.exec(it.key_);
    if (!m) continue;
    const [, mount, kind] = m;
    const host = it.hosts[0]?.name ?? "?";
    const id = `${host}|${mount}`;
    const entry = fs.get(id) ?? { name: `${host} / ${mount.replace(/^"|"$/g, "")}` };
    entry[kind as "used" | "total"] = Number(it.lastvalue);
    fs.set(id, entry);
  }

  const minTb = Number(env("ZABBIX_STORAGE_MIN_TB", "1"));
  return [...fs.values()]
    .filter((f): f is { name: string; used: number; total: number } =>
      f.used !== undefined && f.total !== undefined && f.total / TB >= minTb,
    )
    .sort((a, b) => b.used / b.total - a.used / a.total)
    .slice(0, limit)
    .map((f) => ({ name: f.name, usedTb: f.used / TB, totalTb: f.total / TB }));
}

// ---------- cached entry points (never throw) ----------

export async function zabbixHosts(): Promise<Result<HostSummary>> {
  "use cache";
  const r = await attempt(() => fetchZabbixHosts());
  if (r.ok) cacheLife("live");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}

export async function zabbixProblems(): Promise<Result<Problem[]>> {
  "use cache";
  const r = await attempt(() => fetchZabbixProblems());
  if (r.ok) cacheLife("live");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}

export async function zabbixStorage(limit = 4): Promise<Result<Storage[]>> {
  "use cache";
  const r = await attempt(() => fetchZabbixStorage(limit));
  if (r.ok) cacheLife("slow");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}
