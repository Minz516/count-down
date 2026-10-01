import { SkeletonRow } from "@/components/SkeletonRow";

export default function GroupsLoading() {
  return (
    <div className="min-h-dvh">
      <div className="h-16 border-b border-primary-container/10" />
      <main className="mx-auto flex max-w-[640px] flex-col gap-3 px-4 py-8 sm:px-12">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </main>
    </div>
  );
}
