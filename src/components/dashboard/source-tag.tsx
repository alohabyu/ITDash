import type { Loaded } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/** Small tag in a card header saying where its data came from. */
const short: Record<string, string> = { elasticsearch: "elastic", prometheus: "prom" };
const shorten = (s: string) => s.split(" + ").map((p) => short[p] ?? p).join(" + ");

export function SourceTag({ loaded }: { loaded: Loaded<unknown> }) {
  const label = shorten(loaded.via ?? loaded.source);

  if (loaded.status === "live") {
    // live, but one of several sources failed
    if (loaded.warning) {
      return (
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-warning"
          title={`Partial data — ${loaded.warning}`}
        >
          <span className="size-1.5 rounded-full bg-warning" />
          {label} · partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground" title="Live data">
        <span className="size-1.5 rounded-full bg-success" />
        {label}
      </span>
    );
  }
  if (loaded.status === "sample") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-sm border border-dashed px-1.5 font-mono text-[10.5px] text-muted-foreground"
        title={`Sample data — ${loaded.reason}`}
      >
        sample
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-destructive" title={loaded.error}>
      <span className="size-1.5 rounded-full bg-destructive" />
      {label} down
    </span>
  );
}

/** Body shown instead of data when a source fails. */
export function SourceError({ error, className }: { error: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border border-dashed border-destructive/40 bg-destructive/[0.05] p-3 font-mono text-xs",
        className,
      )}
      role="alert"
    >
      <span className="text-destructive">✗ could not load data</span>
      <span className="break-all text-muted-foreground">{error}</span>
    </div>
  );
}

/** Body shown when a source answered but had nothing to show. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-md border border-dashed py-10 font-mono text-xs text-muted-foreground">
      {children}
    </div>
  );
}
