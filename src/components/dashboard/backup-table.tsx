import type { BackupJob } from "@/lib/data/types";
import { Badge } from "@/components/ui/badge";

const statusBadge: Record<BackupJob["status"], { tone: "ok" | "warn" | "crit" | "info" | "neutral"; text: string }> = {
  success: { tone: "ok", text: "ok" },
  warning: { tone: "warn", text: "warn" },
  failed: { tone: "crit", text: "failed" },
  running: { tone: "info", text: "running" },
  unknown: { tone: "neutral", text: "n/a" },
};

export function backupSummary(jobs: BackupJob[]) {
  const failed = jobs.filter((j) => j.status === "failed").length;
  const warn = jobs.filter((j) => j.status === "warning").length;
  return { total: jobs.length, failed, warn };
}

export function BackupTable({ jobs, limit = 8 }: { jobs: BackupJob[]; limit?: number }) {
  const shown = jobs.slice(0, limit);
  const showSystem = new Set(jobs.map((j) => j.system)).size > 1;
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[440px] text-left text-[13px]">
        <thead>
          <tr className="label border-b border-dashed">
            <th className="px-4 pb-2 font-normal">Job</th>
            <th className="px-2 pb-2 font-normal">Last run</th>
            <th className="px-2 pb-2 text-right font-normal">Data</th>
            <th className="px-4 pb-2 text-right font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed">
          {shown.map((j) => {
            const b = statusBadge[j.status];
            return (
              <tr key={`${j.system}:${j.job}`} className="hover:bg-accent/40">
                <td className="max-w-[220px] px-4 py-2.5">
                  <div className="truncate font-mono text-xs" title={j.job}>
                    {j.job}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {showSystem ? <span className="font-mono text-primary/80">{j.system} </span> : null}
                    {j.target}
                  </div>
                </td>
                <td className="px-2 py-2.5 font-mono text-xs tabular-nums">
                  {j.lastRun}
                  <div className="text-[11px] text-muted-foreground">{j.duration}</div>
                </td>
                <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">{j.detail}</td>
                <td className="px-4 py-2.5 text-right">
                  <Badge tone={b.tone}>
                    {j.status === "running" ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
                    {b.text}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {jobs.length > limit ? (
        <p className="px-4 pt-2 font-mono text-[11px] text-muted-foreground">+ {jobs.length - limit} more jobs</p>
      ) : null}
    </div>
  );
}
