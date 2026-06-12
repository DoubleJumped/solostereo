import { OverviewEmptyState } from "@/components/overview/empty-state";
import { SummaryCards } from "@/components/overview/summary-cards";
import { getOverviewStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const stats = getOverviewStats();

  if (stats.rawPlays === 0) return <OverviewEmptyState />;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex items-baseline justify-between pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">
          overview
        </h1>
      </section>

      <SummaryCards stats={stats} />
    </div>
  );
}
