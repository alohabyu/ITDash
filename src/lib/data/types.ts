/**
 * Shared data shapes. Every adapter (Zabbix, Prometheus, Elasticsearch, mock)
 * returns these types, so UI components never care where data came from.
 */

export type Kpi = {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  /** whether the delta is good, bad or neutral news */
  trend: "good" | "bad" | "flat";
  /** recent samples normalised to 0..1, drawn as a segment strip (optional) */
  spark?: number[];
};

export type Incident = {
  id: string;
  title: string;
  host: string;
  severity: "warning" | "average" | "high" | "disaster";
  /** epoch ms */
  since: number;
};

export type ThroughputPoint = { time: string; inbound: number; outbound: number };

export type ServiceStatus = "up" | "degraded" | "down" | "maint" | "nodata";
export type ServiceRow = {
  name: string;
  host: string;
  /** percent over the uptime window, or null if unknown */
  uptime: number | null;
  /** recent health checks, oldest first */
  checks: ServiceStatus[];
};

export type TicketCategory = { category: string; open: number; breaching: number };

export type Storage = { name: string; usedTb: number; totalTb: number };

export type LogLevel = "INFO" | "WARN" | "CRIT" | "OK";
export type LogLine = {
  /** epoch ms */
  time: number;
  level: LogLevel;
  source: string;
  message: string;
};

export type BackupJob = {
  system: "veeam" | "cohesity" | "sample";
  job: string;
  /** repository, workload type, or "source → target" */
  target: string;
  /** "02:00" in the display timezone, or "never" */
  lastRun: string;
  /** epoch ms of the last run, for sorting (0 if never) */
  lastRunAt: number;
  duration: string;
  /** size written, object count, … */
  detail: string;
  status: "success" | "warning" | "failed" | "running" | "unknown";
};

/** Where a card's data came from, and whether it's real. */
export type SourceName = "zabbix" | "prometheus" | "elasticsearch" | "veeam" | "cohesity" | "mixed" | "sample";

/** `via` overrides the tag text, e.g. "veeam + cohesity" for a merged card. */
export type Loaded<T> =
  | { status: "live"; source: SourceName; via?: string; data: T; warning?: string }
  | { status: "sample"; source: SourceName; via?: string; data: T; reason: string }
  | { status: "error"; source: SourceName; via?: string; error: string };
