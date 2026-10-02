// A Discord webhook URL is a secret. The Settings pages call it straight from the browser, so
// Sentry's automatic fetch breadcrumbs and spans would otherwise record it verbatim.
const WEBHOOK_URL = /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/[^\s"'<>)]+/gi;
const REDACTED = "https://discord.com/api/webhooks/[redacted]";

// Events normally nest well under this; the cap only guards against pathological input.
const MAX_DEPTH = 25;

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Walks plain objects and arrays in place, redacting webhook URLs inside strings. It does NOT
 * serialize anything: server-side events can reach Node internals such as timers (`Timeout`,
 * `TimersList`) that point back at themselves, and `JSON.stringify` throws on those ("Converting
 * circular structure to JSON"). `seen` makes every object visited once, so cycles are harmless,
 * and class instances (timers, errors, buffers) are left untouched rather than traversed.
 */
function scrubInPlace(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (typeof value === "string") return value.replace(WEBHOOK_URL, REDACTED);
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH || seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = scrubInPlace(value[index], seen, depth + 1);
    }
    return value;
  }

  if (!isPlainObject(value)) return value;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = scrubInPlace(record[key], seen, depth + 1);
  }
  return value;
}

/**
 * Redacts Discord webhook URLs anywhere in an event, transaction or breadcrumb. If scrubbing itself
 * fails (for example a frozen object), it returns `null` so Sentry drops that item: losing one
 * report is better than sending a secret, and the hook must never throw into the app.
 */
export function scrubSecrets<T>(value: T): T | null {
  try {
    return scrubInPlace(value, new WeakSet(), 0) as T;
  } catch {
    return null;
  }
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
