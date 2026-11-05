import "server-only";

import { formatSince, normalise } from "@/lib/format";
import type { Result } from "@/lib/sources/http";
import { elasticConfigured, esErrorStats, esRecentLogs } from "@/lib/sources/elasticsearch";
import { prometheusConfigured, promLatency, promServices, promThroughput } from "@/lib/sources/prometheus";
import { cohesityConfigured, cohesityGroups } from "@/lib/sources/cohesity";
import { veeamConfigured, veeamJobs } from "@/lib/sources/veeam";
import { zabbixConfigured, zabbixHosts, zabbixProblems, zabbixStorage } from "@/lib/sources/zabbix";
import * as mock from "./mock";
import type {
  BackupJob,
  Incident,
  Kpi,
  Loaded,
  LogLevel,
  LogLine,
  ServiceRow,
  SourceName,
  Storage,
  ThroughputPoint,
  TicketCategory,
} from "./types";

/**
 * One loader per card. Each decides:
 *   - DATA_SOURCE=mock (default)  → sample data, tagged "sample"
 *   - source not configured        → sample data, tagged with the reason
 *   - source configured            → live data, or an error state if the call fails
 *
 * Failures never fall back to sample numbers — an ops screen must not show
 * plausible-looking fake data when a system is down.
 *
 * Call these only from components that have awaited `connection()`,
 * so env vars are read at request time and nothing is fetched during the build.
 */

/** Turn a cached Result back into a value, or throw with the real upstream message. */
function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

const liveMode = () => process.env.DATA_SOURCE === "live";

async function load<T>(
  source: Exclude<SourceName, "mixed" | "sample">,
  configured: boolean,
  fetcher: () => Promise<T>,
  sample: T,
): Promise<Loaded<T>> {
  if (!liveMode()) return { status: "sample", source, data: sample, reason: "DATA_SOURCE=mock" };
  if (!configured) return { status: "sample", source, data: sample, reason: `${source} not configured` };
  try {
    return { status: "live", source, data: await fetcher() };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[itdash] ${error}`);
    return { status: "error", source, error };
  }
}

// ---------- KPIs ----------

export function loadHostsKpi(): Promise<Loaded<Kpi>> {
  return load("zabbix", zabbixConfigured(), async () => {
    const h = unwrap(await zabbixHosts());
    const down = h.total - h.up;
    return {
      label: "Hosts up",
      value: String(h.up),
      unit: `/${h.total}`,
      delta: down ? `${down} unreachable${down <= 2 ? `: ${h.unreachable.join(", ")}` : ""}` : "all reachable",
      trend: down ? "bad" : "good",
    };
  }, mock.mockKpis.hosts);
}

export function loadProblemsKpi(): Promise<Loaded<Kpi>> {
  return load("zabbix", zabbixConfigured(), async () => {
    const p = unwrap(await zabbixProblems());
    const high = p.filter((x) => x.severity >= 4).length;
    const other = p.length - high;
    return {
      label: "Active problems",
      value: String(p.length),
      delta: p.length ? `${high} high+ · ${other} lower` : "no open problems",
      trend: high ? "bad" : p.length ? "flat" : "good",
    };
  }, mock.mockKpis.problems);
}

export function loadLatencyKpi(): Promise<Loaded<Kpi>> {
  return load("prometheus", prometheusConfigured(), async () => {
    const l = unwrap(await promLatency());
    const first = l.history[0];
    const diff = l.current !== null && first !== undefined ? l.current - first : 0;
    return {
      label: "Probe latency",
      value: l.current === null ? "—" : l.current.toFixed(l.current < 10 ? 1 : 0),
      unit: "ms",
      delta: l.current === null ? "no data" : `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(0)} ms vs 2 h ago`,
      trend: diff > 20 ? "bad" : "flat",
      spark: normalise(l.history),
    };
  }, mock.mockKpis.latency);
}

export function loadErrorsKpi(): Promise<Loaded<Kpi>> {
  return load("elasticsearch", elasticConfigured(), async () => {
    const e = unwrap(await esErrorStats());
    const diff = e.current - e.previous;
    return {
      label: "Log errors · 1h",
      value: String(e.current),
      delta: `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff)} vs prev hour`,
      trend: diff > 0 ? "bad" : diff < 0 ? "good" : "flat",
      spark: normalise(e.buckets),
    };
  }, mock.mockKpis.errors);
}

// ---------- cards ----------

const SEVERITY: Incident["severity"][] = ["warning", "warning", "warning", "average", "high", "disaster"];

/** The most severe open problem (high or disaster), or null when all is well. */
export function loadIncident(): Promise<Loaded<Incident | null>> {
  return load("zabbix", zabbixConfigured(), async () => {
    const p = (unwrap(await zabbixProblems()))
      .filter((x) => x.severity >= 4)
      .sort((a, b) => b.severity - a.severity || b.since - a.since)[0];
    return p ? { id: p.id, title: p.name, host: p.host, severity: SEVERITY[p.severity], since: p.since } : null;
  }, mock.mockIncident);
}

export function loadThroughput(): Promise<Loaded<ThroughputPoint[]>> {
  return load("prometheus", prometheusConfigured(), async () => unwrap(await promThroughput()), mock.mockThroughput);
}

export function loadServices(): Promise<Loaded<ServiceRow[]>> {
  return load("prometheus", prometheusConfigured(), async () => unwrap(await promServices()), mock.mockServices);
}

export function loadStorage(): Promise<Loaded<Storage[]>> {
  return load("zabbix", zabbixConfigured(), async () => unwrap(await zabbixStorage()), mock.mockStorage);
}

/**
 * Load from several sources and merge. A card stays live if at least one configured
 * source answered; the failed ones are reported in `warning` (shown on the tag).
 */
async function loadMerged<T>(
  parts: { name: Exclude<SourceName, "mixed" | "sample">; configured: boolean; fetch: () => Promise<T[]> }[],
  merge: (items: T[]) => T[],
  sample: T[],
): Promise<Loaded<T[]>> {
  const names = parts.map((p) => p.name).join(" + ");
  if (!liveMode()) return { status: "sample", source: "mixed", via: names, data: sample, reason: "DATA_SOURCE=mock" };

  const active = parts.filter((p) => p.configured);
  if (!active.length) {
    return { status: "sample", source: "mixed", via: names, data: sample, reason: `${names} not configured` };
  }

  const results = await Promise.allSettled(active.map((p) => p.fetch()));
  const items: T[] = [];
  const errors: string[] = [];
  results.forEach((r) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  });
  errors.forEach((e) => console.error(`[itdash] ${e}`));

  const via = active.map((p) => p.name).join(" + ");
  const source = active.length === 1 ? active[0].name : "mixed";
  if (errors.length === active.length) return { status: "error", source, via, error: errors.join(" · ") };
  return { status: "live", source, via, data: merge(items), warning: errors.length ? errors.join(" · ") : undefined };
}

/** Zabbix problems + Elasticsearch warning/error logs, newest first. */
export function loadEvents(): Promise<Loaded<LogLine[]>> {
  return loadMerged<LogLine>(
    [
      {
        name: "zabbix",
        configured: zabbixConfigured(),
        fetch: async () =>
          unwrap(await zabbixProblems())
            .slice(0, 10)
            .map((p) => {
              const level: LogLevel = p.severity >= 4 ? "CRIT" : p.severity >= 2 ? "WARN" : "INFO";
              return { time: p.since, level, source: p.host, message: `${p.name} (open ${formatSince(p.since)})` };
            }),
      },
      { name: "elasticsearch", configured: elasticConfigured(), fetch: async () => unwrap(await esRecentLogs()) },
    ],
    (lines) => lines.sort((a, b) => b.time - a.time).slice(0, 10),
    mock.mockLogs,
  );
}

const backupRank: Record<BackupJob["status"], number> = { failed: 0, warning: 1, running: 2, unknown: 3, success: 4 };

/** Veeam jobs + Cohesity protection groups — problems first, then most recent. */
export function loadBackups(): Promise<Loaded<BackupJob[]>> {
  return loadMerged<BackupJob>(
    [
      { name: "veeam", configured: veeamConfigured(), fetch: async () => unwrap(await veeamJobs()) },
      { name: "cohesity", configured: cohesityConfigured(), fetch: async () => unwrap(await cohesityGroups()) },
    ],
    (jobs) => jobs.sort((a, b) => backupRank[a.status] - backupRank[b.status] || b.lastRunAt - a.lastRunAt),
    mock.mockBackups,
  );
}

// no source connected yet — always sample
export async function loadTickets(): Promise<Loaded<TicketCategory[]>> {
  return { status: "sample", source: "sample", data: mock.mockTickets, reason: "no ticket system connected" };
}
