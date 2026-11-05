import type { Kpi, Loaded } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { SourceTag } from "./source-tag";

/** A strip of vertical segments — reads like an LED level meter. */
function SegmentStrip({ values, tone }: { values: number[]; tone: Kpi["trend"] }) {
  const w = 4;
  const gap = 2;
  const h = 28;
  return (
    <svg
      viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`}
      className={cn("h-7 w-full", tone === "bad" ? "text-warning" : "text-primary")}
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

/** Placeholder strip when a KPI has no history (keeps tile heights equal). */
function FlatStrip() {
  return <div className="h-7 border-b border-dashed" aria-hidden />;
}

export function KpiTile({ loaded, label }: { loaded: Loaded<Kpi>; label: string }) {
  if (loaded.status === "error") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="label">{label}</span>
          <SourceTag loaded={loaded} />
        </div>
        <span className="font-mono text-3xl font-semibold text-muted-foreground">—</span>
        <FlatStrip />
        <p className="truncate font-mono text-[11.5px] text-destructive" title={loaded.error}>
          {loaded.error}
        </p>
      </div>
    );
  }

  const kpi = loaded.data;
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label truncate">{kpi.label}</span>
        <SourceTag loaded={loaded} />
      </div>
      <div className="flex items-baseline gap-1 font-mono">
        <span className="text-2xl font-semibold tracking-tight sm:text-3xl dark:glow">{kpi.value}</span>
        {kpi.unit ? <span className="text-sm text-muted-foreground">{kpi.unit}</span> : null}
      </div>
      {kpi.spark?.length ? <SegmentStrip values={kpi.spark} tone={kpi.trend} /> : <FlatStrip />}
      <p
        className={cn(
          "truncate font-mono text-[11.5px]",
          kpi.trend === "good" && "text-success",
          kpi.trend === "bad" && "text-warning",
          kpi.trend === "flat" && "text-muted-foreground",
        )}
        title={kpi.delta}
      >
        {kpi.trend === "good" ? "✓ " : kpi.trend === "bad" ? "! " : "· "}
        {kpi.delta}
      </p>
    </div>
  );
}
