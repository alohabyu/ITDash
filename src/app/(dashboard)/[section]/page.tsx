import Link from "next/link";
import { notFound } from "next/navigation";

import { allNavItems } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";

/**
 * Placeholder for every sidebar entry that doesn't have a real page yet.
 * When you build e.g. /tickets, create `src/app/(dashboard)/tickets/page.tsx` —
 * a static folder always wins over this dynamic one.
 */
const sections = allNavItems.filter((i) => i.href !== "/");

export function generateStaticParams() {
  return sections.map((i) => ({ section: i.href.slice(1) }));
}

export async function generateMetadata({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  const item = sections.find((i) => i.href === `/${section}`);
  return { title: item?.title ?? "Not found" };
}

export default async function SectionPage({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  const item = sections.find((i) => i.href === `/${section}`);
  if (!item) notFound();

  const Icon = item.icon;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={section} title={item.title} />
      <div className="grid place-items-center rounded-lg border border-dashed bg-card/60 px-6 py-20 text-center">
        <Icon className="mb-4 size-8 text-primary" strokeWidth={1.5} />
        <p className="font-mono text-sm">
          <span className="text-muted-foreground">$</span> ls ./{section}
        </p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          (empty) — this page hasn&apos;t been built yet.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link href="/">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}
