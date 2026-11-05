import type { Kpi } from "@/lib/data/overview";
import { cn } from "@/lib/utils";

/** A strip of vertical segments — reads like an LED level meter. */
function SegmentStrip({ values, tone }: { values: number[]; tone: Kpi["trend"] }) {
  const w = 4;
  const gap = 2;
  const h = 28;
  return (
    <svg
      viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`}
      className={cn(
        "h-7 w-full",
        tone === "bad" ? "text-warning" : "text-primary",
      )}
      preserveAspectRatio="none"
      aria-hidden
    >
      {values.map((v, i) => {
        const bh = Math.max(2, Math.round(v * h));
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bh}
            width={w}
            height={bh}
            rx={0.5}
            fill="currentColor"
            opacity={0.25 + (i / values.length) * 0.75}
          />
        );
      })}
    </svg>
  );
}

export function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label">{kpi.label}</span>
        <span
          className={cn(
            "size-1.5 rounded-full",
            kpi.trend === "bad" ? "bg-warning" : kpi.trend === "good" ? "bg-success" : "bg-muted-foreground/50",
          )}
          aria-hidden
        />
      </div>
      <div className="flex items-baseline gap-1 font-mono">
        <span className="text-2xl font-semibold tracking-tight sm:text-3xl dark:glow">{kpi.value}</span>
        {kpi.unit ? <span className="text-sm text-muted-foreground">{kpi.unit}</span> : null}
      </div>
      <SegmentStrip values={kpi.spark} tone={kpi.trend} />
      <p
        className={cn(
          "font-mono text-[11.5px]",
          kpi.trend === "good" && "text-success",
          kpi.trend === "bad" && "text-warning",
          kpi.trend === "flat" && "text-muted-foreground",
        )}
      >
        {kpi.trend === "good" ? "▼ " : kpi.trend === "bad" ? "▲ " : "· "}
        {kpi.delta}
      </p>
    </div>
  );
}
