import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-muted", className)} />;
}

export function KpiSkeleton() {
  return (
    <div className="flex h-[150px] flex-col gap-3 rounded-lg border bg-card p-4" aria-busy>
      <Bar className="h-3 w-24" />
      <Bar className="h-8 w-16" />
      <Bar className="h-7 w-full" />
      <Bar className="h-3 w-28" />
    </div>
  );
}

export function CardSkeleton({
  title,
  description,
  className,
  height = 240,
}: {
  title: string;
  description?: string;
  className?: string;
  height?: number;
}) {
  return (
    <Card className={className} aria-busy>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent>
        <Bar className="w-full" />
        <div className="animate-pulse rounded-sm bg-muted/60" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export function BannerSkeleton() {
  return <div className="h-[42px] animate-pulse rounded-lg border bg-muted/40" aria-busy />;
}
