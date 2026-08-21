import { SkeletonRow } from "@/components/SkeletonRow";

export default function DashboardLoading() {
  return (
    <div className="min-h-dvh">
      <div className="h-16 border-b border-primary-container/10" />
      <main className="mx-auto flex max-w-[800px] flex-col gap-6 px-4 py-8 sm:px-12">
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
