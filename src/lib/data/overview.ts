/**
 * Mock data for the Overview page.
 *
 * Everything here is deterministic (seeded) so server and client renders match.
 * To go live, replace each export with a fetch to your monitoring / ITSM APIs —
 * the page only depends on the types below.
 */

// ---------- helpers ----------
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------- types ----------
export type Kpi = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  delta: string;
  /** whether the delta is good, bad or neutral news */
  trend: "good" | "bad" | "flat";
  /** 24 recent samples, 0..1, drawn as a segment strip */
  spark: number[];
};

export type ThroughputPoint = { time: string; inbound: number; outbound: number };

export type ServiceStatus = "up" | "degraded" | "down" | "maint";
export type ServiceRow = {
  name: string;
  host: string;
  uptime: number; // percent, 30 days
  /** last 36 health checks, oldest first */
  checks: ServiceStatus[];
};

export type TicketCategory = { category: string; open: number; breaching: number };

export type Storage = { name: string; usedTb: number; totalTb: number };

export type LogLevel = "INFO" | "WARN" | "CRIT" | "OK";
export type LogLine = { ts: string; level: LogLevel; source: string; message: string };

export type BackupJob = {
  job: string;
  target: string;
  lastRun: string;
  duration: string;
  size: string;
  status: "success" | "warning" | "failed" | "running";
};

// ---------- data ----------
const rnd = seeded(42);

function spark(base: number, spread: number) {
  return Array.from({ length: 24 }, () => Math.min(1, Math.max(0.05, base + (rnd() - 0.5) * spread)));
}

export const kpis: Kpi[] = [
  {
    id: "services",
    label: "Services up",
    value: "41",
    unit: "/43",
    delta: "2 degraded",
    trend: "bad",
    spark: spark(0.9, 0.15),
  },
  {
    id: "tickets",
    label: "Open tickets",
    value: "14",
    delta: "−5 vs yesterday",
    trend: "good",
    spark: spark(0.55, 0.6),
  },
  {
    id: "latency",
    label: "WAN latency",
    value: "18",
    unit: "ms",
    delta: "+2 ms p95",
    trend: "flat",
    spark: spark(0.4, 0.35),
  },
  {
    id: "backup",
    label: "Backups · 7d",
    value: "97.6",
    unit: "%",
    delta: "1 job failed",
    trend: "bad",
    spark: spark(0.95, 0.1),
  },
];

export const throughput: ThroughputPoint[] = Array.from({ length: 24 }, (_, h) => {
  // office-hours curve: quiet at night, peak late morning and mid-afternoon
  const office = Math.exp(-((h - 10.5) ** 2) / 8) + 0.85 * Math.exp(-((h - 14.5) ** 2) / 6);
  const inbound = Math.round(60 + office * 720 + rnd() * 60);
  const outbound = Math.round(35 + office * 310 + rnd() * 40);
  return { time: `${String(h).padStart(2, "0")}:00`, inbound, outbound };
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

export const services: ServiceRow[] = [
  { name: "Email / Exchange", host: "mx-01", uptime: 99.98, checks: checks("stable") },
  { name: "Active Directory", host: "dc-01, dc-02", uptime: 100, checks: checks("stable") },
  { name: "e-Office (DMS)", host: "app-03", uptime: 99.41, checks: checks("incident") },
  { name: "HR & Payroll", host: "app-05", uptime: 99.9, checks: checks("maint") },
  { name: "VPN Gateway", host: "fw-edge", uptime: 99.62, checks: checks("flaky") },
  { name: "File server", host: "nas-01", uptime: 99.95, checks: checks("stable") },
  { name: "Public website", host: "web-lb", uptime: 99.99, checks: checks("stable") },
];

export const tickets: TicketCategory[] = [
  { category: "Hardware", open: 5, breaching: 1 },
  { category: "Account / access", open: 4, breaching: 0 },
  { category: "Network", open: 2, breaching: 1 },
  { category: "Software", open: 2, breaching: 0 },
  { category: "Printer", open: 1, breaching: 0 },
];

export const storage: Storage[] = [
  { name: "nas-01 / shared", usedTb: 38.2, totalTb: 48 },
  { name: "san-a / vm-datastore", usedTb: 21.7, totalTb: 32 },
  { name: "backup-vault", usedTb: 71.4, totalTb: 80 },
  { name: "mx-01 / mailstore", usedTb: 4.1, totalTb: 8 },
];

export const logs: LogLine[] = [
  { ts: "14:31:07", level: "CRIT", source: "app-03", message: "e-Office: HTTP 503 from upstream, 3 consecutive checks" },
  { ts: "14:29:52", level: "WARN", source: "backup", message: "Job 'sql-nightly' finished with 2 skipped files" },
  { ts: "14:24:10", level: "INFO", source: "ad", message: "Account unlocked: s.kittipong (by helpdesk-2)" },
  { ts: "14:18:33", level: "WARN", source: "fw-edge", message: "VPN tunnel to branch-04 flapped (2x in 10 min)" },
  { ts: "14:05:00", level: "OK", source: "patch", message: "Windows patch ring 1 complete — 112/112 hosts" },
  { ts: "13:58:41", level: "INFO", source: "desk", message: "Ticket #4821 resolved: printer queue reset (2F)" },
  { ts: "13:40:16", level: "WARN", source: "san-a", message: "Datastore vm-ds-02 above 80% capacity" },
  { ts: "13:12:09", level: "OK", source: "cert", message: "TLS certificate renewed for intranet.example.org" },
];

export const backups: BackupJob[] = [
  { job: "vm-daily", target: "san-a → vault", lastRun: "02:00", duration: "1h 42m", size: "1.8 TB", status: "success" },
  { job: "sql-nightly", target: "db-01 → vault", lastRun: "01:30", duration: "38m", size: "212 GB", status: "warning" },
  { job: "fileshare-inc", target: "nas-01 → vault", lastRun: "03:00", duration: "22m", size: "64 GB", status: "success" },
  { job: "mailstore", target: "mx-01 → cloud", lastRun: "00:15", duration: "—", size: "—", status: "failed" },
  { job: "config-snap", target: "net devices", lastRun: "14:00", duration: "running", size: "—", status: "running" },
];

export const lastSync = "14:32 ICT";
