import { Download, Plus } from "lucide-react";

import {
  backups,
  kpis,
  lastSync,
  logs,
  services,
  storage,
  throughput,
  tickets,
} from "@/lib/data/overview";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupTable } from "@/components/dashboard/backup-table";
import { EventLog } from "@/components/dashboard/event-log";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ServiceMatrix, ServiceMatrixLegend } from "@/components/dashboard/service-matrix";
import { StorageMeters } from "@/components/dashboard/storage-meters";
import { ThroughputChart, ThroughputLegend } from "@/components/dashboard/throughput-chart";
import { TicketQueue } from "@/components/dashboard/ticket-queue";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata = { title: "Overview" };

export default function OverviewPage() {
  const totalOpen = tickets.reduce((s, t) => s + t.open, 0);
  const breaching = tickets.reduce((s, t) => s + t.breaching, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="overview"
        title="Operations overview"
        description={`Snapshot of network, services, service desk and backups · synced ${lastSync}`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
            <Button size="sm">
              <Plus /> New ticket
            </Button>
          </>
        }
      />

      {/* status banner */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-2.5 font-mono text-xs">
        <span className="flex items-center gap-2 text-warning">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-warning" />
          </span>
          DEGRADED
        </span>
        <span className="text-foreground">e-Office returning 503 since 14:22 — on-call notified.</span>
        <span className="text-muted-foreground sm:ml-auto">incident #INC-0193</span>
      </div>

      {/* KPI row */}
      <section aria-label="Key indicators" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiTile key={k.id} kpi={k} />
        ))}
      </section>

      {/* throughput + storage */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <div>
              <CardTitle>WAN throughput · 24h</CardTitle>
              <CardDescription>Core uplink, hourly average in Mbps</CardDescription>
            </div>
            <CardAction>
              <ThroughputLegend />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ThroughputChart data={throughput} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Storage capacity</CardTitle>
              <CardDescription>Used vs provisioned</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <StorageMeters data={storage} />
          </CardContent>
        </Card>
      </section>

      {/* services + tickets */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex-wrap">
            <div>
              <CardTitle>Service health</CardTitle>
              <CardDescription>Checks every 5 min · last 3 hours · 30-day uptime</CardDescription>
            </div>
            <CardAction>
              <ServiceMatrixLegend />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ServiceMatrix rows={services} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Ticket queue</CardTitle>
              <CardDescription>
                {totalOpen} open · <span className="text-destructive">{breaching} breaching SLA</span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <TicketQueue data={tickets} />
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
      </section>

      {/* event log + backups */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Event log</CardTitle>
              <CardDescription>Aggregated from syslog, backup and service desk</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-2 py-3">
            <EventLog lines={logs} />
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Backup jobs</CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BackupTable jobs={backups} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
