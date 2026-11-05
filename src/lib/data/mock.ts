/**
 * Sample data, used when DATA_SOURCE=mock or when a card has no source configured.
 * Deterministic (seeded) so server and client renders always match.
 */
import type {
  BackupJob,
  Incident,
  Kpi,
  LogLine,
  ServiceRow,
  ServiceStatus,
  Storage,
  ThroughputPoint,
  TicketCategory,
} from "./types";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rnd = seeded(42);

function spark(base: number, spread: number) {
  return Array.from({ length: 24 }, () => Math.min(1, Math.max(0.05, base + (rnd() - 0.5) * spread)));
}

// a fixed "now" so sample timestamps are stable: 2026-11-05 14:32 ICT
const NOW = Date.UTC(2026, 10, 5, 7, 32, 0);
const ago = (min: number) => NOW - min * 60_000;

export const mockKpis = {
  hosts: {
    label: "Hosts up",
    value: "41",
    unit: "/43",
    delta: "2 unreachable",
    trend: "bad",
    spark: spark(0.9, 0.15),
  },
  problems: {
    label: "Active problems",
    value: "6",
    delta: "1 high · 5 warning",
    trend: "bad",
    spark: spark(0.45, 0.6),
  },
  latency: {
    label: "Probe latency",
    value: "18",
    unit: "ms",
    delta: "avg of all probes",
    trend: "flat",
    spark: spark(0.4, 0.35),
  },
  errors: {
    label: "Log errors · 1h",
    value: "37",
    delta: "−12 vs prev hour",
    trend: "good",
    spark: spark(0.35, 0.5),
  },
} satisfies Record<string, Kpi>;

export const mockIncident: Incident = {
  id: "INC-0193",
  title: "e-Office returning HTTP 503",
  host: "app-03",
  severity: "high",
  since: ago(10),
};

export const mockThroughput: ThroughputPoint[] = Array.from({ length: 24 }, (_, h) => {
  const office = Math.exp(-((h - 10.5) ** 2) / 8) + 0.85 * Math.exp(-((h - 14.5) ** 2) / 6);
  return {
    time: `${String(h).padStart(2, "0")}:00`,
    inbound: Math.round(60 + office * 720 + rnd() * 60),
    outbound: Math.round(35 + office * 310 + rnd() * 40),
  };
});

function checks(profile: "stable" | "flaky" | "incident" | "maint"): ServiceStatus[] {
  return Array.from({ length: 36 }, (_, i) => {
    const r = rnd();
    if (profile === "maint" && i >= 20 && i <= 23) return "maint";
    if (profile === "incident" && i >= 29 && i <= 31) return "down";
    if (profile === "incident" && i >= 32) return "degraded";
    if (profile === "flaky" && r > 0.82) return "degraded";
    if (profile === "stable" && r > 0.985) return "degraded";
    return "up";
  });
}

export const mockServices: ServiceRow[] = [
  { name: "Email / Exchange", host: "mx-01", uptime: 99.98, checks: checks("stable") },
  { name: "Active Directory", host: "dc-01, dc-02", uptime: 100, checks: checks("stable") },
  { name: "e-Office (DMS)", host: "app-03", uptime: 99.41, checks: checks("incident") },
  { name: "HR & Payroll", host: "app-05", uptime: 99.9, checks: checks("maint") },
  { name: "VPN Gateway", host: "fw-edge", uptime: 99.62, checks: checks("flaky") },
  { name: "File server", host: "nas-01", uptime: 99.95, checks: checks("stable") },
  { name: "Public website", host: "web-lb", uptime: 99.99, checks: checks("stable") },
];

export const mockTickets: TicketCategory[] = [
  { category: "Hardware", open: 5, breaching: 1 },
  { category: "Account / access", open: 4, breaching: 0 },
  { category: "Network", open: 2, breaching: 1 },
  { category: "Software", open: 2, breaching: 0 },
  { category: "Printer", open: 1, breaching: 0 },
];

export const mockStorage: Storage[] = [
  { name: "nas-01 / shared", usedTb: 38.2, totalTb: 48 },
  { name: "san-a / vm-datastore", usedTb: 21.7, totalTb: 32 },
  { name: "backup-vault", usedTb: 71.4, totalTb: 80 },
  { name: "mx-01 / mailstore", usedTb: 4.1, totalTb: 8 },
];

export const mockLogs: LogLine[] = [
  { time: ago(1), level: "CRIT", source: "app-03", message: "e-Office: HTTP 503 from upstream, 3 consecutive checks" },
  { time: ago(2), level: "WARN", source: "backup", message: "Job 'sql-nightly' finished with 2 skipped files" },
  { time: ago(8), level: "INFO", source: "ad", message: "Account unlocked: s.kittipong (by helpdesk-2)" },
  { time: ago(14), level: "WARN", source: "fw-edge", message: "VPN tunnel to branch-04 flapped (2x in 10 min)" },
  { time: ago(27), level: "OK", source: "patch", message: "Windows patch ring 1 complete — 112/112 hosts" },
  { time: ago(33), level: "INFO", source: "desk", message: "Ticket #4821 resolved: printer queue reset (2F)" },
  { time: ago(52), level: "WARN", source: "san-a", message: "Datastore vm-ds-02 above 80% capacity" },
  { time: ago(80), level: "OK", source: "cert", message: "TLS certificate renewed for intranet.example.org" },
];

export const mockBackups: BackupJob[] = [
  { system: "sample", job: "vm-daily", target: "→ vault-repo", lastRun: "02:00", lastRunAt: ago(752), duration: "1h 42m", detail: "1.8 TB", status: "success" },
  { system: "sample", job: "sql-nightly", target: "→ vault-repo", lastRun: "01:30", lastRunAt: ago(782), duration: "38m", detail: "212 GB", status: "warning" },
  { system: "sample", job: "fileshare-inc", target: "Physical", lastRun: "03:00", lastRunAt: ago(692), duration: "22m", detail: "64 GB", status: "success" },
  { system: "sample", job: "mailstore", target: "→ cloud-tier", lastRun: "00:15", lastRunAt: ago(857), duration: "—", detail: "—", status: "failed" },
  { system: "sample", job: "config-snap", target: "net devices", lastRun: "14:00", lastRunAt: ago(32), duration: "running", detail: "—", status: "running" },
];
