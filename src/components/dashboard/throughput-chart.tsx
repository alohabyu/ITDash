"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ThroughputPoint } from "@/lib/data/types";

const series = [
  { key: "inbound", label: "Inbound", color: "var(--chart-1)" },
  { key: "outbound", label: "Outbound", color: "var(--chart-2)" },
] as const;

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
};

function ChartTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 font-mono text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
            <span className="w-16 text-muted-foreground">{s.label}</span>
            <span className="tabular-nums">{String(p?.value ?? "—")} Mbps</span>
          </div>
        );
      })}
    </div>
  );
}

export function ThroughputLegend() {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            interval={3}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={44}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <Tooltip
            content={<ChartTip />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="step"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={1.5}
              fill={`url(#fill-${s.key})`}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
