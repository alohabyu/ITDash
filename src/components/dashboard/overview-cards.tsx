import { connection } from "next/server";

import {
  loadBackups,
  loadErrorsKpi,
  loadEvents,
  loadHostsKpi,
  loadIncident,
  loadLatencyKpi,
  loadProblemsKpi,
  loadServices,
  loadStorage,
  loadThroughput,
  loadTickets,
} from "@/lib/data";
import type { Kpi, Loaded } from "@/lib/data/types";
import { formatSince } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupTable, backupSummary } from "./backup-table";
import { EventLog } from "./event-log";
import { KpiTile } from "./kpi-tile";
import { ServiceMatrix, ServiceMatrixLegend } from "./service-matrix";
import { EmptyState, SourceError, SourceTag } from "./source-tag";
import { StorageMeters } from "./storage-meters";
import { ThroughputChart, ThroughputLegend } from "./throughput-chart";
import { TicketQueue } from "./ticket-queue";

/*
 * Each card is an async Server Component wrapped in its own <Suspense> on the page.
 * `await connection()` makes it render per request (never at build time), and the
 * adapters' `"use cache"` keeps upstream load low between requests.
 */

// ---------- KPIs ----------

const kpiLoaders: Record<string, { label: string; load: () => Promise<Loaded<Kpi>> }> = {
  hosts: { label: "Hosts up", load: loadHostsKpi },
  problems: { label: "Active problems", load: loadProblemsKpi },
  latency: { label: "Probe latency", load: loadLatencyKpi },
  errors: { label: "Log errors · 1h", load: loadErrorsKpi },
};
export const kpiIds = Object.keys(kpiLoaders);

export async function KpiCard({ id }: { id: string }) {
  await connection();
  const k = kpiLoaders[id];
  return <KpiTile loaded={await k.load()} label={k.label} />;
}

// ---------- incident banner ----------

export async function IncidentBanner() {
  await connection();
  const loaded = await loadIncident();

  if (loaded.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="text-destructive">STATUS UNKNOWN</span>
        <span className="truncate">{loaded.error}</span>
      </div>
    );
  }

  const inc = loaded.data;
  if (!inc) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-success/30 bg-success/[0.06] px-4 py-2.5 font-mono text-xs">
        <span className="flex items-center gap-2 text-success">
          <span className="size-2 rounded-full bg-success" />
          ALL CLEAR
        </span>
        <span>No high or disaster problems open in Zabbix.</span>
        <span className="sm:ml-auto">
          <SourceTag loaded={loaded} />
        </span>
      </div>
    );
  }

  const severe = inc.severity === "disaster";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 font-mono text-xs",
        severe ? "border-destructive/40 bg-destructive/[0.07]" : "border-warning/30 bg-warning/[0.06]",
      )}
      role="status"
    >
      <span className={cn("flex items-center gap-2 uppercase", severe ? "text-destructive" : "text-warning")}>
        <span className="relative flex size-2">
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              severe ? "bg-destructive" : "bg-warning",
            )}
          />
          <span className={cn("relative inline-flex size-2 rounded-full", severe ? "bg-destructive" : "bg-warning")} />
        </span>
        {inc.severity}
      </span>
      <span className="min-w-0 text-foreground">
        {inc.host}: {inc.title} — open {formatSince(inc.since)}
      </span>
      <span className="flex items-center gap-3 text-muted-foreground sm:ml-auto">
        event #{inc.id}
        <SourceTag loaded={loaded} />
      </span>
    </div>
  );
}

// ---------- cards ----------

/** Shown under merged cards when one of their sources failed. */
function PartialNote({ loaded }: { loaded: Loaded<unknown> }) {
  if (loaded.status !== "live" || !loaded.warning) return null;
  return <p className="mt-3 break-all font-mono text-[11px] text-warning">! missing: {loaded.warning}</p>;
}

function Header({
  title,
  description,
  loaded,
  extra,
}: {
  title: string;
  description?: React.ReactNode;
  loaded: Loaded<unknown>;
  extra?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex-wrap">
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      <CardAction className="flex items-center gap-3">
        {extra}
        <SourceTag loaded={loaded} />
      </CardAction>
    </CardHeader>
  );
}

export async function ThroughputCard({ className }: { className?: string }) {
  await connection();
  const loaded = await loadThroughput();
  return (
    <Card className={className}>
      <Header title="WAN throughput · 24h" description="Hourly average in Mbps" loaded={loaded} extra={<ThroughputLegend />} />
      <CardContent>
        {loaded.status === "error" ? <SourceError error={loaded.error} /> : <ThroughputChart data={loaded.data} />}
      </CardContent>
    </Card>
  );
}

export async function StorageCard({ className }: { className?: string }) {
  await connection();
  const loaded = await loadStorage();
  return (
    <Card className={className}>
      <Header title="Storage capacity" description="Fullest filesystems" loaded={loaded} />
      <CardContent>
        {loaded.status === "error" ? (
          <SourceError error={loaded.error} />
        ) : loaded.data.length ? (
          <StorageMeters data={loaded.data} />
        ) : (
          <EmptyState>no filesystems ≥ ZABBIX_STORAGE_MIN_TB</EmptyState>
        )}
      </CardContent>
    </Card>
  );
}

export async function ServicesCard({ className }: { className?: string }) {
  await connection();
  const loaded = await loadServices();
  return (
    <Card className={className}>
      <Header
        title="Service health"
        description="Checks every 5 min · last 3 hours · 30-day uptime"
        loaded={loaded}
        extra={<ServiceMatrixLegend />}
      />
      <CardContent>
        {loaded.status === "error" ? (
          <SourceError error={loaded.error} />
        ) : loaded.data.length ? (
          <ServiceMatrix rows={loaded.data} />
        ) : (
          <EmptyState>no probe series returned by PROM_Q_PROBE</EmptyState>
        )}
      </CardContent>
    </Card>
  );
}

export async function TicketsCard({ className }: { className?: string }) {
  const loaded = await loadTickets();
  const data = loaded.status === "error" ? [] : loaded.data;
  const total = data.reduce((s, t) => s + t.open, 0);
  const breaching = data.reduce((s, t) => s + t.breaching, 0);
  return (
    <Card className={className}>
      <Header
        title="Ticket queue"
        description={
          <>
            {total} open · <span className="text-destructive">{breaching} breaching SLA</span>
          </>
        }
        loaded={loaded}
      />
      <CardContent className="flex flex-1 flex-col">
        <TicketQueue data={data} />
        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-dashed pt-4 font-mono">
          <div>
            <dt className="label">First response</dt>
            <dd className="mt-1 text-lg">
              12<span className="text-xs text-muted-foreground"> min</span>
            </dd>
          </div>
          <div>
            <dt className="label">MTTR · 30d</dt>
            <dd className="mt-1 text-lg">
              3h 40<span className="text-xs text-muted-foreground"> min</span>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export async function EventsCard({ className }: { className?: string }) {
  await connection();
  const loaded = await loadEvents();
  return (
    <Card className={className}>
      <Header title="Event log" description="Open Zabbix problems + warning/error logs" loaded={loaded} />
      <CardContent className="px-2 py-3">
        {loaded.status === "error" ? (
          <SourceError error={loaded.error} className="mx-2" />
        ) : loaded.data.length ? (
          <EventLog lines={loaded.data} />
        ) : (
          <EmptyState>nothing to report in the last 24 h</EmptyState>
        )}
        <div className="px-2">
          <PartialNote loaded={loaded} />
        </div>
      </CardContent>
    </Card>
  );
}

export async function BackupsCard({ className }: { className?: string }) {
  await connection();
  const loaded = await loadBackups();
  const sum = loaded.status === "error" ? null : backupSummary(loaded.data);
  return (
    <Card className={className}>
      <Header
        title="Backup jobs"
        description={
          sum ? (
            <>
              {sum.total} jobs ·{" "}
              <span className={sum.failed ? "text-destructive" : undefined}>{sum.failed} failed</span>
              {sum.warn ? ` · ${sum.warn} warning` : ""}
            </>
          ) : (
            "Last run of each job"
          )
        }
        loaded={loaded}
      />
      <CardContent>
        {loaded.status === "error" ? (
          <SourceError error={loaded.error} />
        ) : loaded.data.length ? (
          <BackupTable jobs={loaded.data} />
        ) : (
          <EmptyState>no active backup jobs</EmptyState>
        )}
        <PartialNote loaded={loaded} />
      </CardContent>
    </Card>
  );
}
