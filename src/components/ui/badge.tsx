import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        ok: "border-success/30 bg-success/10 text-success",
        warn: "border-warning/35 bg-warning/10 text-warning",
        crit: "border-destructive/35 bg-destructive/10 text-destructive",
        info: "border-info/30 bg-info/10 text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
