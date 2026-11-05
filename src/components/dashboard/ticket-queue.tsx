import type { TicketCategory } from "@/lib/data/overview";

/** Horizontal bars, drawn with CSS — no chart library needed for this one. */
export function TicketQueue({ data }: { data: TicketCategory[] }) {
  const max = Math.max(...data.map((d) => d.open));
  return (
    <ul className="flex flex-col gap-3.5">
      {data.map((d) => (
        <li key={d.category}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate">{d.category}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums">
              {d.open}
              {d.breaching ? (
                <span className="ml-2 text-destructive">{d.breaching} SLA</span>
              ) : null}
            </span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-chart-1"
              style={{ width: `${((d.open - d.breaching) / max) * 100}%` }}
            />
            {d.breaching ? (
              <div className="h-full bg-destructive" style={{ width: `${(d.breaching / max) * 100}%` }} />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
