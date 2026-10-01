/** Mirrors app/settings/page.tsx: heading, then the Discord Digest card. */
export default function SettingsLoading() {
  return (
    <div className="min-h-dvh">
      <div className="h-16 border-b border-primary-container/10" />
      <main className="mx-auto flex max-w-[560px] flex-col gap-6 px-4 pt-8 pb-28 sm:px-8 sm:pb-12">
        <div className="h-8 w-1/3 animate-pulse rounded bg-surface-elevated" />
        <div className="h-64 animate-pulse rounded-lg bg-surface-container" />
      </main>
    </div>
  );
}
