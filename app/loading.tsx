import { SkeletonRow } from "@/components/SkeletonRow";

/** Mirrors the dashboards' shell (components/DashboardClient.tsx): same container, two columns from lg. */
export default function DashboardLoading() {
  return (
    <div className="min-h-dvh">
      <div className="h-16 border-b border-primary-container/10" />
      <main className="mx-auto grid max-w-[1120px] gap-10 px-4 pt-8 pb-28 sm:px-8 sm:pb-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12 lg:px-12">
        <div className="h-64 animate-pulse rounded-lg bg-surface-container" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}
