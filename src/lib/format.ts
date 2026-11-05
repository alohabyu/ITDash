/** Display timezone for all timestamps (servers usually run in UTC). */
export const TIMEZONE = process.env.DASH_TIMEZONE || "Asia/Bangkok";

const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIMEZONE });
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: TIMEZONE,
});

/** epoch ms → "14:00" */
export function formatHour(ms: number) {
  return hourFmt.format(ms);
}

/** epoch ms → "14:31:07" */
export function formatTime(ms: number) {
  return Number.isFinite(ms) ? timeFmt.format(ms) : "--:--:--";
}

/** epoch ms → "12 min" / "3 h" relative to now */
export function formatSince(ms: number, now = Date.now()) {
  const min = Math.max(0, Math.round((now - ms) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d`;
}

/** scale a series to 0..1 for the KPI segment strip */
export function normalise(values: number[]): number[] {
  if (!values.length) return [];
  const max = Math.max(...values);
  if (max <= 0) return values.map(() => 0.05);
  return values.map((v) => Math.max(0.05, v / max));
}

/** ms → "1h 42m" / "38m" / "45s" */
export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** bytes → "212 GB" / "1.8 TB" (binary units, labelled the way admins expect) */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}
