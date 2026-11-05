import type { Storage } from "@/lib/data/overview";
import { cn } from "@/lib/utils";

const SEGMENTS = 20;

/** Segmented capacity bars: green below 75%, amber to 90%, red above. */
export function StorageMeters({ data }: { data: Storage[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {data.map((d) => {
        const pct = (d.usedTb / d.totalTb) * 100;
        const lit = Math.round((pct / 100) * SEGMENTS);
        const tone = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-primary";
        return (
          <li key={d.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-xs">{d.name}</span>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs tabular-nums",
                  pct >= 90 ? "text-destructive" : pct >= 75 ? "text-warning" : "text-muted-foreground",
                )}
              >
                {pct.toFixed(0)}%
              </span>
            </div>
            <div
              className="flex h-2.5 gap-[3px]"
              role="meter"
              aria-label={`${d.name} usage`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <span key={i} className={cn("flex-1 rounded-[1px]", i < lit ? tone : "bg-muted")} />
              ))}
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              {d.usedTb.toFixed(1)} / {d.totalTb} TB
            </div>
          </li>
        );
      })}
    </ul>
  );
}
