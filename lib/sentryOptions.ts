// A Discord webhook URL is a secret. The Settings pages call it straight from the browser, so
// Sentry's automatic fetch breadcrumbs and spans would otherwise record it verbatim.
// [^...x5c] stops at a backslash so a match never eats the escape before a closing quote (that would
// break the JSON round trip in scrubSecrets).
const WEBHOOK_URL = /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/[^\s"'<>)\x5c]+/gi;
const REDACTED = "https://discord.com/api/webhooks/[redacted]";

/** Deep-replaces webhook URLs anywhere in an event, transaction or breadcrumb. */
export function scrubSecrets<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(WEBHOOK_URL, REDACTED)) as T;
}

/**
 * Shared by instrumentation.ts (server and edge) and instrumentation-client.ts so every runtime
 * reports the same way. 10% of requests are traced: enough for Web Vitals trends without paying
 * for every page view. `sendDefaultPii` stays off, so IPs, cookies and headers are not attached.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  // The generic scrub infers each hook's own event type, so no Sentry type imports are needed.
  beforeSend: scrubSecrets,
  beforeSendTransaction: scrubSecrets,
  beforeBreadcrumb: scrubSecrets,
};
