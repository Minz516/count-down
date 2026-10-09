"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { useT } from "@/components/LocaleProvider";

/**
 * Next.js error boundary for this route segment - catches anything thrown by
 * `app/page.tsx` (e.g. a `DatabaseError` from the events module) instead of a
 * blank screen. Treats failure as a
 * first-class state, adapted to Next's own error-boundary convention
 * rather than a formatted HTTP error envelope.
 */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-xl font-semibold text-on-surface">{t("error.page.title")}</h1>
      <p className="max-w-sm font-body text-sm text-text-muted">
        {error.message ? t.text(error.message) : t("error.page.body")}
      </p>
      <Button onClick={reset}>{t("error.page.retry")}</Button>
    </div>
  );
}
