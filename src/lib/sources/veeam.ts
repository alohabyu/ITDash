import "server-only";
import { cacheLife } from "next/cache";

import type { BackupJob } from "@/lib/data/types";
import { formatDuration, formatTime } from "@/lib/format";
import { attempt, env, fetchJson, type Result, SourceError, stripTrailingSlash } from "./http";

/**
 * Veeam Backup & Replication REST API adapter (v12 / v13).
 *
 * Env:
 *   VEEAM_URL           https://vbr.example.local:9419
 *   VEEAM_USERNAME      account with the "Veeam Backup Viewer" role
 *   VEEAM_PASSWORD
 *   VEEAM_API_VERSION   must match your server, e.g. 1.2-rev0 (v12.x) or 1.3-rev1 (v13.0.1)
 *                       — see https://<vbr>:9419/swagger/ui/index.html
 *
 * The B&R server usually has a self-signed certificate: export it and set
 * NODE_EXTRA_CA_CERTS=/path/to/vbr.pem rather than disabling TLS checks.
 */

export function veeamConfigured() {
  return Boolean(env("VEEAM_URL") && env("VEEAM_USERNAME") && env("VEEAM_PASSWORD"));
}

const base = () => stripTrailingSlash(env("VEEAM_URL"));
const apiVersion = () => env("VEEAM_API_VERSION", "1.2-rev0");

async function token(): Promise<string> {
  const body = await fetchJson<{ access_token?: string }>("veeam", `${base()}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "x-api-version": apiVersion() },
    body: new URLSearchParams({
      grant_type: "password",
      username: env("VEEAM_USERNAME"),
      password: env("VEEAM_PASSWORD"),
    }),
  });
  if (!body.access_token) throw new SourceError("veeam", "login failed (no access_token)");
  return body.access_token;
}

type JobState = {
  id: string;
  name: string;
  type?: string;
  /** running | inactive | disabled */
  status?: string;
  /** None | Success | Warning | Failed */
  lastResult?: string;
  lastRun?: string;
  nextRun?: string;
  repositoryName?: string;
  objectsCount?: number;
  progressPercent?: number;
};

type SessionsPage = {
  data: { jobId?: string; name: string; creationTime?: string; endTime?: string; state?: string }[];
};

function toStatus(j: JobState): BackupJob["status"] {
  if (j.status?.toLowerCase() === "running") return "running";
  switch (j.lastResult?.toLowerCase()) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

async function fetchVeeamJobs(): Promise<BackupJob[]> {
  const t = await token();
  const headers = { Authorization: `Bearer ${t}`, "x-api-version": apiVersion() };

  const [states, sessions] = await Promise.all([
    fetchJson<{ data: JobState[] }>("veeam", `${base()}/api/v1/jobs/states?limit=200`, { headers }),
    // recent sessions give us durations; jobs/states doesn't
    fetchJson<SessionsPage>("veeam", `${base()}/api/v1/sessions?limit=200&orderColumn=CreationTime&orderAsc=false`, {
      headers,
    }).catch(() => ({ data: [] }) as SessionsPage),
  ]);

  const lastSession = new Map<string, SessionsPage["data"][number]>();
  for (const s of sessions.data) {
    if (s.jobId && !lastSession.has(s.jobId) && s.endTime) lastSession.set(s.jobId, s);
  }

  return states.data
    .filter((j) => j.status?.toLowerCase() !== "disabled")
    .map((j): BackupJob => {
      const s = lastSession.get(j.id);
      const start = s?.creationTime ? Date.parse(s.creationTime) : NaN;
      const end = s?.endTime ? Date.parse(s.endTime) : NaN;
      const status = toStatus(j);
      return {
        system: "veeam",
        job: j.name,
        target: j.repositoryName ? `→ ${j.repositoryName}` : (j.type ?? ""),
        lastRun: j.lastRun ? formatTime(Date.parse(j.lastRun)).slice(0, 5) : "never",
        lastRunAt: j.lastRun ? Date.parse(j.lastRun) : 0,
        duration:
          status === "running"
            ? `${j.progressPercent ?? 0}%`
            : Number.isFinite(start) && Number.isFinite(end)
              ? formatDuration(end - start)
              : "—",
        detail: j.objectsCount !== undefined ? `${j.objectsCount} obj` : "—",
        status,
      };
    });
}

export async function veeamJobs(): Promise<Result<BackupJob[]>> {
  "use cache";
  const r = await attempt(fetchVeeamJobs);
  if (r.ok) cacheLife("ops");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}
