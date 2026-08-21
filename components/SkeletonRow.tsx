export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary-container/10 bg-surface-container px-4 py-3">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-surface-elevated" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-surface-elevated" />
      </div>
      <div className="h-3 w-16 animate-pulse rounded-full bg-surface-elevated" />
    </div>
  );
}
