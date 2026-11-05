import "server-only";
import { cacheLife } from "next/cache";

import type { BackupJob } from "@/lib/data/types";
import { formatBytes, formatDuration, formatTime } from "@/lib/format";
import { attempt, env, fetchJson, type Result, SourceError, stripTrailingSlash } from "./http";

/**
 * Cohesity DataProtect (on-prem cluster) REST API v2 adapter.
 *
 * Env:
 *   COHESITY_URL        https://cohesity-cluster.example.local   (cluster VIP)
 *   COHESITY_API_KEY    API key (Settings → Access Management → API Keys), sent as `apiKey` header
 *     — or —
 *   COHESITY_USERNAME / COHESITY_PASSWORD / COHESITY_DOMAIN (default LOCAL)
 *
 * Use an account with a view-only role (e.g. Viewer). Field names follow the v2
 * protection-groups API; verify against your cluster's API explorer if a field is empty.
 */

export function cohesityConfigured() {
  return Boolean(env("COHESITY_URL") && (env("COHESITY_API_KEY") || env("COHESITY_USERNAME")));
}

const base = () => stripTrailingSlash(env("COHESITY_URL"));

async function authHeaders(): Promise<HeadersInit> {
  const key = env("COHESITY_API_KEY");
  if (key) return { apiKey: key };

  const body = await fetchJson<{ accessToken?: string; tokenType?: string }>("cohesity", `${base()}/v2/access-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env("COHESITY_USERNAME"),
      password: env("COHESITY_PASSWORD"),
      domain: env("COHESITY_DOMAIN", "LOCAL"),
    }),
  });
  if (!body.accessToken) throw new SourceError("cohesity", "login failed (no accessToken)");
  return { Authorization: `${body.tokenType ?? "Bearer"} ${body.accessToken}` };
}

type ProtectionGroup = {
  id: string;
  name: string;
  environment?: string;
  isPaused?: boolean;
  isActive?: boolean;
  lastRun?: {
    localBackupInfo?: {
      status?: string;
      startTimeUsecs?: number;
      endTimeUsecs?: number;
      localSnapshotStats?: { logicalSizeBytes?: number; bytesWritten?: number };
    };
  };
};

function toStatus(s?: string): BackupJob["status"] {
  switch ((s ?? "").toLowerCase()) {
    case "succeeded":
      return "success";
    case "succeededwithwarning":
      return "warning";
    case "failed":
    case "canceled":
    case "missed":
      return "failed";
    case "running":
    case "accepted":
    case "finalizing":
    case "onhold":
      return "running";
    default:
      return "unknown";
  }
}

async function fetchCohesityGroups(): Promise<BackupJob[]> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ isDeleted: "false", isActive: "true", includeLastRunInfo: "true" });
  const body = await fetchJson<{ protectionGroups?: ProtectionGroup[] | null }>(
    "cohesity",
    `${base()}/v2/data-protect/protection-groups?${qs}`,
    { headers },
  );

  return (body.protectionGroups ?? [])
    .filter((g) => !g.isPaused)
    .map((g): BackupJob => {
      const info = g.lastRun?.localBackupInfo;
      const start = info?.startTimeUsecs ? info.startTimeUsecs / 1000 : 0;
      const end = info?.endTimeUsecs ? info.endTimeUsecs / 1000 : 0;
      const written = info?.localSnapshotStats?.bytesWritten;
      const status = info ? toStatus(info.status) : "unknown";
      return {
        system: "cohesity",
        job: g.name,
        target: (g.environment ?? "").replace(/^k/, ""), // kVMware → VMware
        lastRun: start ? formatTime(start).slice(0, 5) : "never",
        lastRunAt: start,
        duration: status === "running" ? "running" : start && end ? formatDuration(end - start) : "—",
        detail: written !== undefined ? formatBytes(written) : "—",
        status,
      };
    });
}

export async function cohesityGroups(): Promise<Result<BackupJob[]>> {
  "use cache";
  const r = await attempt(fetchCohesityGroups);
  if (r.ok) cacheLife("ops");
  else cacheLife("retry"); // failures are retried after 15 s
  return r;
}
