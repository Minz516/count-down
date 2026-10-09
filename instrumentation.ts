import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryOptions";

/**
 * Server/edge error tracking - a no-op
 * until NEXT_PUBLIC_SENTRY_DSN is set (see .env.local.example), so this ships inert
 * rather than requiring a Sentry account to exist before the app can build/run.
 * Runs for both the Node runtime (Server Components, Route Handlers) and the Edge
 * runtime (proxy.ts) - Sentry.init is safe to call from either. This is the single
 * place the server and edge SDKs start; there are no separate sentry.*.config.ts files.
 */
export function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
