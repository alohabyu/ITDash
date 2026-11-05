import "server-only";
import { cacheLife } from "next/cache";

import type { LogLevel, LogLine } from "@/lib/data/types";
import { attempt, env, envList, fetchJson, type Result, SourceError, stripTrailingSlash } from "./http";

/**
 * Elasticsearch adapter for logs (ECS field names by default).
 *
 * Env:
 *   ES_URL                  https://elastic.example.local:9200
 *   ES_API_KEY              base64 API key (preferred), or ES_USER / ES_PASSWORD
 *   ES_INDEX                index pattern, default "logs-*"
 *   ES_TIME_FIELD           default "@timestamp"
 *   ES_LEVEL_FIELD          default "log.level"
 *   ES_MESSAGE_FIELD        default "message"
 *   ES_SOURCE_FIELD         default "host.name"
 *   ES_FILTER               optional Lucene query to narrow logs, e.g.  NOT service.name:nginx-access
 *   ES_LOG_LEVELS           levels shown in the event log (default warn + error and above)
 *   ES_ERROR_LEVELS         levels counted as errors for the KPI
 */

const F = {
  index: () => env("ES_INDEX", "logs-*"),
  time: () => env("ES_TIME_FIELD", "@timestamp"),
  level: () => env("ES_LEVEL_FIELD", "log.level"),
  message: () => env("ES_MESSAGE_FIELD", "message"),
  source: () => env("ES_SOURCE_FIELD", "host.name"),
};

const ERROR_LEVELS = ["error", "err", "crit", "critical", "fatal", "alert", "emerg", "emergency"];
const WARN_LEVELS = ["warn", "warning"];

export function elasticConfigured() {
  return Boolean(env("ES_URL") && (env("ES_API_KEY") || env("ES_USER")));
}

function authHeaders(): HeadersInit {
  const key = env("ES_API_KEY");
  if (key) return { Authorization: `ApiKey ${key}` };
  return {
    Authorization: `Basic ${Buffer.from(`${env("ES_USER")}:${env("ES_PASSWORD")}`).toString("base64")}`,
  };
}

/** Level values differ in case between shippers (error / ERROR / Error) — match all. */
function withCases(levels: string[]) {
  return [...new Set(levels.flatMap((l) => [l, l.toUpperCase(), l[0].toUpperCase() + l.slice(1)]))];
}

function filters(levels: string[], gte: string) {
  const extra = env("ES_FILTER");
  return [
    { range: { [F.time()]: { gte } } },
    { terms: { [F.level()]: withCases(levels) } },
    ...(extra ? [{ query_string: { query: extra } }] : []),
  ];
}

type SearchResponse = {
  hits?: { hits: { _id: string; _source: Record<string, unknown> }[] };
  aggregations?: Record<string, { doc_count: number; per5m?: { buckets: { doc_count: number }[] } }>;
  error?: { reason?: string; type?: string };
};

async function search(body: object): Promise<SearchResponse> {
  const url = `${stripTrailingSlash(env("ES_URL"))}/${encodeURIComponent(F.index())}/_search`;
  const res = await fetchJson<SearchResponse>("elasticsearch", url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.error) throw new SourceError("elasticsearch", res.error.reason ?? res.error.type ?? "search failed");
  return res;
}

/** Read "a.b.c" from either nested objects or a flattened "a.b.c" key. */
function pick(src: Record<string, unknown>, path: string): unknown {
  if (path in src) return src[path];
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), src);
}

function toLevel(raw: unknown): LogLevel {
  const l = String(raw ?? "").toLowerCase();
  if (ERROR_LEVELS.includes(l)) return "CRIT";
  if (WARN_LEVELS.includes(l)) return "WARN";
  return "INFO";
}

/** Latest warning/error lines from the last 24 h. */
async function fetchEsRecentLogs(size = 12): Promise<LogLine[]> {
  const levels = envList("ES_LOG_LEVELS");
  const res = await search({
    size,
    sort: [{ [F.time()]: "desc" }],
    _source: [F.time(), F.level(), F.message(), F.source()],
    query: { bool: { filter: filters(levels.length ? levels : [...WARN_LEVELS, ...ERROR_LEVELS], "now-24h") } },
  });

  return (res.hits?.hits ?? []).map((h) => {
    const s = h._source;
    const msg = String(pick(s, F.message()) ?? "").split("\n")[0];
    return {
      time: Date.parse(String(pick(s, F.time()))),
      level: toLevel(pick(s, F.level())),
      source: String(pick(s, F.source()) ?? "elastic"),
      message: msg.length > 200 ? `${msg.slice(0, 197)}…` : msg,
    };
  });
}

/** Error count in the last hour vs the hour before, plus 5-minute buckets for a sparkline. */
async function fetchEsErrorStats(): Promise<{ current: number; previous: number; buckets: number[] }> {
  const levels = envList("ES_ERROR_LEVELS");
  const t = F.time();
  const res = await search({
    size: 0,
    track_total_hits: false,
    query: { bool: { filter: filters(levels.length ? levels : ERROR_LEVELS, "now-2h") } },
    aggs: {
      previous: { filter: { range: { [t]: { gte: "now-2h", lt: "now-1h" } } } },
      current: {
        filter: { range: { [t]: { gte: "now-1h" } } },
        aggs: {
          per5m: {
            date_histogram: {
              field: t,
              fixed_interval: "5m",
              min_doc_count: 0,
              extended_bounds: { min: "now-1h", max: "now" },
            },
          },
        },
      },
    },
  });

  const aggs = res.aggregations ?? {};
  return {
    current: aggs.current?.doc_count ?? 0,
    previous: aggs.previous?.doc_count ?? 0,
    buckets: (aggs.current?.per5m?.buckets ?? []).map((b) => b.doc_count),
  };
}

// ---------- cached entry points (never throw) ----------

export async function esRecentLogs(size = 12): Promise<Result<LogLine[]>> {
  "use cache";
  const r = await attempt(() => fetchEsRecentLogs(size));
  if (r.ok) cacheLife("live");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}

export async function esErrorStats(): Promise<Result<{ current: number; previous: number; buckets: number[] }>> {
  "use cache";
  const r = await attempt(() => fetchEsErrorStats());
  if (r.ok) cacheLife("live");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}
