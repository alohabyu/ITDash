import { Suspense } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import {
  BackupsCard,
  EventsCard,
  IncidentBanner,
  KpiCard,
  ServicesCard,
  StorageCard,
  ThroughputCard,
  TicketsCard,
  kpiIds,
} from "@/components/dashboard/overview-cards";
import { PageHeader } from "@/components/dashboard/page-header";
import { BannerSkeleton, CardSkeleton, KpiSkeleton } from "@/components/dashboard/skeletons";

export const metadata = { title: "Overview" };

/**
 * The page itself is a static shell; every card streams in on its own,
 * so a slow or unreachable source only affects its own card.
 */
export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="overview"
        title="Operations overview"
        description="Zabbix · Prometheus · Elasticsearch · Veeam · Cohesity — refreshes every 60 s"
        actions={
          <AutoRefresh seconds={60}>
            <Button variant="outline" size="sm">
              <RefreshCw /> Refresh
            </Button>
          </AutoRefresh>
        }
      />

      <Suspense fallback={<BannerSkeleton />}>
        <IncidentBanner />
      </Suspense>

      <section aria-label="Key indicators" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpiIds.map((id) => (
          <Suspense key={id} fallback={<KpiSkeleton />}>
            <KpiCard id={id} />
          </Suspense>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Suspense fallback={<CardSkeleton title="WAN throughput · 24h" className="lg:col-span-8" height={260} />}>
          <ThroughputCard className="lg:col-span-8" />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Storage capacity" className="lg:col-span-4" />}>
          <StorageCard className="lg:col-span-4" />
        </Suspense>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Suspense fallback={<CardSkeleton title="Service health" className="lg:col-span-8" height={320} />}>
          <ServicesCard className="lg:col-span-8" />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Ticket queue" className="lg:col-span-4" />}>
          <TicketsCard className="lg:col-span-4" />
        </Suspense>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Suspense fallback={<CardSkeleton title="Event log" className="min-w-0 lg:col-span-7" />}>
          <EventsCard className="min-w-0 lg:col-span-7" />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Backup jobs" className="min-w-0 lg:col-span-5" />}>
          <BackupsCard className="min-w-0 lg:col-span-5" />
        </Suspense>
      </section>
    </div>
  );
}
