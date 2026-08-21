"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";

/**
 * Next.js error boundary for this route segment - catches anything thrown by
 * `app/page.tsx` (e.g. a `DatabaseError` from the events module) instead of a
 * blank screen. Matches docs/ARCHITECTURE_DESIGN.md §6's "failure as a
 * first-class state" principle, adapted to Next's own error-boundary convention
 * rather than a formatted HTTP error envelope.
 */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-xl font-semibold text-on-surface">Something went wrong</h1>
      <p className="max-w-sm font-body text-sm text-text-muted">
        {error.message || "Please try again."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
