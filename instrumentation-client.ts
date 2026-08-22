import * as Sentry from "@sentry/nextjs";

// Client-side error tracking (docs/PRODUCTION_READINESS_CHECKLIST.md §11) - mirrors
// instrumentation.ts's guard, a no-op until NEXT_PUBLIC_SENTRY_DSN is set.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

// Lets Sentry attribute errors/spans to the App Router navigation they happened during.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
