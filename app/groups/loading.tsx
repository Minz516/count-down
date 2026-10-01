import { SkeletonRow } from "@/components/SkeletonRow";

/** Mirrors app/groups/page.tsx: same container, and the same 1/2/3 column grid as the real list. */
export default function GroupsLoading() {
  return (
    <div className="min-h-dvh">
      <div className="h-16 border-b border-primary-container/10" />
      <main className="mx-auto max-w-[1120px] px-4 pt-8 pb-28 sm:px-8 sm:pb-12 lg:px-12">
        <div className="mb-6 h-11 w-40 animate-pulse rounded bg-surface-container" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}
