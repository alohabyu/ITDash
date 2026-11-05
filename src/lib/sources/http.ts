import "server-only";

/** Thrown for any failure talking to an upstream system. Never includes secrets. */
export class SourceError extends Error {
  constructor(source: string, message: string) {
    super(`${source}: ${message}`);
    this.name = "SourceError";
  }
}

const TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS ?? 8000);

/** fetch + JSON with a timeout and a readable error. */
export async function fetchJson<T>(source: string, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    const reason =
      e instanceof Error && e.name === "TimeoutError"
        ? `timed out after ${TIMEOUT_MS} ms`
        : e instanceof Error
          ? (e.cause instanceof Error ? e.cause.message : e.message)
          : String(e);
    throw new SourceError(source, `cannot reach ${new URL(url).host} (${reason})`);
  }
  if (!res.ok) {
    throw new SourceError(source, `HTTP ${res.status} ${res.statusText}`.trim());
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new SourceError(source, "response was not JSON");
  }
}

export function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function envList(name: string): string[] {
  return env(name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * Result of a cached upstream call. Cached functions return this instead of throwing,
 * because Next.js hides the message of errors thrown inside "use cache" in production —
 * and an admin needs to see "Not authorized" or "cannot reach host" on screen.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
