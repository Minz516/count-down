export default function SettingsLoading() {
  return (
    <div className="min-h-dvh">
      <div className="h-16 border-b border-primary-container/10" />
      <main className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 py-8 sm:px-12">
        <div className="h-5 w-1/3 animate-pulse rounded bg-surface-elevated" />
        <div className="h-11 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-24 animate-pulse rounded-lg bg-surface-container" />
      </main>
    </div>
  );
}
