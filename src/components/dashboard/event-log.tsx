import type { LogLevel, LogLine } from "@/lib/data/overview";
import { cn } from "@/lib/utils";

const levelTone: Record<LogLevel, string> = {
  CRIT: "text-destructive",
  WARN: "text-warning",
  INFO: "text-info",
  OK: "text-success",
};

/** Terminal-style event stream, newest first. */
export function EventLog({ lines }: { lines: LogLine[] }) {
  return (
    <div className="overflow-x-auto">
      <ol className="min-w-[520px] font-mono text-[12px] leading-6">
        {lines.map((l, i) => (
          <li
            key={i}
            className={cn(
              "grid grid-cols-[64px_44px_64px_1fr] gap-3 rounded-sm px-2 hover:bg-accent/60",
              l.level === "CRIT" && "bg-destructive/[0.07]",
            )}
          >
            <span className="text-muted-foreground tabular-nums">{l.ts}</span>
            <span className={cn("font-medium", levelTone[l.level])}>{l.level}</span>
            <span className="truncate text-muted-foreground">{l.source}</span>
            <span className="truncate">{l.message}</span>
          </li>
        ))}
        <li className="px-2 text-muted-foreground">
          <span className="text-primary">$</span> tail -f events.log
          <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-primary animate-blink" />
        </li>
      </ol>
    </div>
  );
}
