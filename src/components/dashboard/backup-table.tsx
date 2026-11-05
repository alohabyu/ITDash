import type { BackupJob } from "@/lib/data/overview";
import { Badge } from "@/components/ui/badge";

const statusBadge: Record<BackupJob["status"], { tone: "ok" | "warn" | "crit" | "info"; text: string }> = {
  success: { tone: "ok", text: "ok" },
  warning: { tone: "warn", text: "warn" },
  failed: { tone: "crit", text: "failed" },
  running: { tone: "info", text: "running" },
};

export function BackupTable({ jobs }: { jobs: BackupJob[] }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[440px] text-left text-[13px]">
        <thead>
          <tr className="label border-b border-dashed">
            <th className="px-4 pb-2 font-normal">Job</th>
            <th className="px-2 pb-2 font-normal">Last run</th>
            <th className="px-2 pb-2 text-right font-normal">Size</th>
            <th className="px-4 pb-2 text-right font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed">
          {jobs.map((j) => {
            const b = statusBadge[j.status];
            return (
              <tr key={j.job} className="hover:bg-accent/40">
                <td className="px-4 py-2.5">
                  <div className="font-mono text-xs">{j.job}</div>
                  <div className="text-[11.5px] text-muted-foreground">{j.target}</div>
                </td>
                <td className="px-2 py-2.5 font-mono text-xs tabular-nums">
                  {j.lastRun}
                  <div className="text-[11px] text-muted-foreground">{j.duration}</div>
                </td>
                <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">{j.size}</td>
                <td className="px-4 py-2.5 text-right">
                  <Badge tone={b.tone}>
                    {j.status === "running" ? (
                      <span className="size-1.5 rounded-full bg-current animate-pulse" />
                    ) : null}
                    {b.text}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
