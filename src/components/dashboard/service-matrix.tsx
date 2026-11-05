import type { ServiceRow, ServiceStatus } from "@/lib/data/overview";
import { cn } from "@/lib/utils";

const cellTone: Record<ServiceStatus, string> = {
  up: "bg-primary/70",
  degraded: "bg-warning",
  down: "bg-destructive",
  maint: "bg-info/60",
};

const statusLabel: Record<ServiceStatus, string> = {
  up: "up",
  degraded: "degraded",
  down: "down",
  maint: "maintenance",
};

export function ServiceMatrixLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
      {(Object.keys(cellTone) as ServiceStatus[]).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-[2px]", cellTone[s])} />
          {statusLabel[s]}
        </span>
      ))}
    </div>
  );
}

/**
 * One row per service, one cell per health check (every 5 min → last 3 h).
 * The right-most cell is the latest check.
 */
export function ServiceMatrix({ rows }: { rows: ServiceRow[] }) {
  return (
    <div className="flex flex-col divide-y divide-dashed">
      {rows.map((row) => {
        const current = row.checks[row.checks.length - 1];
        return (
          <div
            key={row.name}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0 md:grid-cols-[180px_minmax(0,1fr)_64px]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", cellTone[current])}
                  aria-hidden
                />
                <span className="truncate text-[13px]">{row.name}</span>
              </div>
              <div className="pl-3.5 font-mono text-[11px] text-muted-foreground">{row.host}</div>
            </div>

            <div
              className="col-span-2 row-start-2 flex h-5 gap-[2px] md:col-span-1 md:row-start-auto"
              role="img"
              aria-label={`${row.name}: currently ${statusLabel[current]}`}
            >
              {row.checks.map((c, i) => (
                <span
                  key={i}
                  title={`${(row.checks.length - 1 - i) * 5} min ago · ${statusLabel[c]}`}
                  className={cn("flex-1 rounded-[1.5px]", cellTone[c], c === "up" && "opacity-80")}
                />
              ))}
            </div>

            <div
              className={cn(
                "text-right font-mono text-xs tabular-nums",
                row.uptime < 99.5 ? "text-warning" : "text-muted-foreground",
              )}
            >
              {row.uptime.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
