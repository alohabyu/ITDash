import "server-only";
import { cacheLife } from "next/cache";

import type { ServiceRow, ServiceStatus, ThroughputPoint } from "@/lib/data/types";
import { formatHour } from "@/lib/format";
import { attempt, env, fetchJson, type Result, SourceError, stripTrailingSlash } from "./http";

/**
 * Prometheus HTTP API adapter.
 *
 * Env:
 *   PROM_URL                https://prometheus.example.local:9090
 *   PROM_TOKEN              optional bearer token (if behind an auth proxy)
 *   PROM_USER / PROM_PASSWORD   optional basic auth
 *
 * Queries (override to match your exporters — see docs/INTEGRATIONS.md):
 *   PROM_Q_WAN_IN / PROM_Q_WAN_OUT   Mbps, a single series each
 *   PROM_Q_PROBE                     0/1 per service (blackbox_exporter probe_success)
 *   PROM_Q_LATENCY                   ms, a single series
 *   PROM_PROBE_NAME_LABEL            label used as the service name (default "instance")
 */

const Q = {
  wanIn: () =>
    env(
      "PROM_Q_WAN_IN",
      'sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m])) * 8 / 1e6',
    ),
  wanOut: () =>
    env(
      "PROM_Q_WAN_OUT",
      'sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m])) * 8 / 1e6',
    ),
  probe: () => env("PROM_Q_PROBE", "probe_success"),
  latency: () => env("PROM_Q_LATENCY", "avg(probe_duration_seconds) * 1000"),
  nameLabel: () => env("PROM_PROBE_NAME_LABEL", "instance"),
};

export function prometheusConfigured() {
  return Boolean(env("PROM_URL"));
}

type Sample = [number, string];
type Series = { metric: Record<string, string>; values?: Sample[]; value?: Sample };
type PromResponse = {
  status: "success" | "error";
  data?: { resultType: string; result: Series[] };
  error?: string;
};

function authHeaders(): HeadersInit {
  const token = env("PROM_TOKEN");
  if (token) return { Authorization: `Bearer ${token}` };
  const user = env("PROM_USER");
  if (user) {
    return { Authorization: `Basic ${Buffer.from(`${user}:${env("PROM_PASSWORD")}`).toString("base64")}` };
  }
  return {};
}

async function prom(path: "query" | "query_range", params: Record<string, string>): Promise<Series[]> {
  const url = `${stripTrailingSlash(env("PROM_URL"))}/api/v1/${path}`;
  const body = await fetchJson<PromResponse>("prometheus", url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() },
    body: new URLSearchParams(params),
  });
  if (body.status !== "success" || !body.data) {
    throw new SourceError("prometheus", body.error ?? "query failed");
  }
  return body.data.result;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// ---------- WAN throughput, last 24 h, hourly averages ----------

async function fetchPromThroughput(): Promise<ThroughputPoint[]> {
  const end = Math.floor(nowSec() / 3600) * 3600; // align to the hour
  const start = end - 23 * 3600;
  const range = { start: String(start), end: String(end), step: "3600" };
  const hourly = (q: string) => `avg_over_time((${q})[1h:5m])`;

  const [inbound, outbound] = await Promise.all([
    prom("query_range", { query: hourly(Q.wanIn()), ...range }),
    prom("query_range", { query: hourly(Q.wanOut()), ...range }),
  ]);
  const toMap = (s: Series[]) => new Map((s[0]?.values ?? []).map(([t, v]) => [t, Number(v)]));
  const inMap = toMap(inbound);
  const outMap = toMap(outbound);

  return Array.from({ length: 24 }, (_, i) => {
    const t = start + i * 3600;
    return {
      time: formatHour(t * 1000),
      inbound: Math.round(inMap.get(t) ?? 0),
      outbound: Math.round(outMap.get(t) ?? 0),
    };
  });
}

// ---------- service checks (blackbox probes), last 3 h at 5 min ----------

const CHECKS = 36;
const STEP = 300;

async function fetchPromServices(limit = 10): Promise<ServiceRow[]> {
  const label = Q.nameLabel();
  const end = Math.floor(nowSec() / STEP) * STEP;
  const start = end - (CHECKS - 1) * STEP;

  const [series, uptime] = await Promise.all([
    prom("query_range", { query: Q.probe(), start: String(start), end: String(end), step: String(STEP) }),
    prom("query", { query: `avg_over_time((${Q.probe()})[30d:5m]) * 100`, time: String(end) }),
  ]);

  const uptimeBy = new Map(uptime.map((s) => [s.metric[label] ?? "", Number(s.value?.[1])]));

  const rows = series.map((s): ServiceRow => {
    const byTime = new Map((s.values ?? []).map(([t, v]) => [t, Number(v)]));
    const checks = Array.from({ length: CHECKS }, (_, i): ServiceStatus => {
      const v = byTime.get(start + i * STEP);
      if (v === undefined || Number.isNaN(v)) return "nodata";
      return v >= 1 ? "up" : v > 0 ? "degraded" : "down";
    });
    const name = s.metric[label] ?? s.metric.instance ?? "unknown";
    const u = uptimeBy.get(name);
    return {
      name: name.replace(/^https?:\/\//, ""),
      host: s.metric.job ?? "",
      uptime: u === undefined || Number.isNaN(u) ? null : u,
      checks,
    };
  });

  // problems first, then alphabetical
  const rank = (r: ServiceRow) => {
    const last = r.checks[r.checks.length - 1];
    return last === "down" ? 0 : last === "degraded" ? 1 : last === "nodata" ? 2 : 3;
  };
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, limit);
}

// ---------- average probe latency, now + last 2 h for the sparkline ----------

async function fetchPromLatency(): Promise<{ current: number | null; history: number[] }> {
  const end = nowSec();
  const series = await prom("query_range", {
    query: Q.latency(),
    start: String(end - 2 * 3600),
    end: String(end),
    step: "300",
  });
  const history = (series[0]?.values ?? []).map(([, v]) => Number(v)).filter((v) => !Number.isNaN(v));
  return { current: history.length ? history[history.length - 1] : null, history };
}

// ---------- cached entry points (never throw) ----------

export async function promThroughput(): Promise<Result<ThroughputPoint[]>> {
  "use cache";
  const r = await attempt(() => fetchPromThroughput());
  if (r.ok) cacheLife("ops");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}

export async function promServices(limit = 10): Promise<Result<ServiceRow[]>> {
  "use cache";
  const r = await attempt(() => fetchPromServices(limit));
  if (r.ok) cacheLife("live");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}

export async function promLatency(): Promise<Result<{ current: number | null; history: number[] }>> {
  "use cache";
  const r = await attempt(() => fetchPromLatency());
  if (r.ok) cacheLife("live");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}
