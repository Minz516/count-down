import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge error tracking (docs/PRODUCTION_READINESS_CHECKLIST.md §11) - a no-op
 * until NEXT_PUBLIC_SENTRY_DSN is set (see .env.local.example), so this ships inert
 * rather than requiring a Sentry account to exist before the app can build/run.
 * Runs for both the Node runtime (Server Components, Route Handlers) and the Edge
 * runtime (proxy.ts) - Sentry.init is safe to call from either.
 */
export function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export const onRequestError = Sentry.captureRequestError;
