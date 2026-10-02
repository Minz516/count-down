import { expect, test } from "@playwright/test";
import { scrubSecrets } from "@/lib/sentryOptions";

// The scrubber runs inside Sentry's beforeSend / beforeSendTransaction / beforeBreadcrumb hooks on
// every runtime. It must redact Discord webhook URLs (secrets) and must never throw.

const WEBHOOK = "https://discord.com/api/webhooks/123456789/AbCdEf_ghi-token";
const REDACTED = "https://discord.com/api/webhooks/[redacted]";

test("redacts webhook URLs in nested objects and arrays, leaves everything else alone", () => {
  const event = {
    message: `POST ${WEBHOOK} failed`,
    breadcrumbs: [{ category: "fetch", data: { url: WEBHOOK, method: "POST" } }],
    extra: { keep: "https://example.com/api/x", count: 3, flag: true, nothing: null },
  };

  const result = scrubSecrets(event);

  expect(result?.message).toBe(`POST ${REDACTED} failed`);
  expect(result?.breadcrumbs[0].data).toEqual({ url: REDACTED, method: "POST" });
  expect(result?.extra).toEqual({ keep: "https://example.com/api/x", count: 3, flag: true, nothing: null });
});

test("also redacts the discordapp.com host and a URL followed by a closing quote", () => {
  const result = scrubSecrets({ message: `say "https://discordapp.com/api/webhooks/9/xyz" now` });
  expect(result?.message).toBe(`say "${REDACTED}" now`);
});

test("does not throw on a real Node timer, which points back at itself (the production failure)", () => {
  // An ACTIVE timer sits in Node's timer list and links to its neighbours; a cleared one unlinks.
  const timer = setTimeout(() => {}, 60_000);
  try {
    // Same shape Sentry reported: "Converting circular structure to JSON ... 'Timeout' ... 'TimersList'".
    expect(() => JSON.stringify(timer)).toThrow(/circular/i);

    const event = { contexts: { runtime: { handle: timer } }, extra: { url: WEBHOOK } };
    const result = scrubSecrets(event);

    expect(result).not.toBeNull();
    expect(result?.contexts.runtime.handle).toBe(timer); // class instances are left untouched
    expect(result?.extra.url).toBe(REDACTED); // and the rest is still scrubbed
  } finally {
    clearTimeout(timer);
  }
});

test("handles plain objects that reference themselves", () => {
  const loop: Record<string, unknown> = { url: WEBHOOK };
  loop.self = loop;
  loop.list = [loop, { again: loop }];

  const result = scrubSecrets(loop);

  expect(result).not.toBeNull();
  expect(result?.url).toBe(REDACTED);
  expect(result?.self).toBe(result);
});

test("returns null instead of throwing when an object cannot be scrubbed", () => {
  const frozen = Object.freeze({ url: WEBHOOK });
  expect(() => scrubSecrets(frozen)).not.toThrow();
  expect(scrubSecrets(frozen)).toBeNull(); // dropped, not leaked
});

test("passes primitives and empty values through", () => {
  expect(scrubSecrets("plain text")).toBe("plain text");
  expect(scrubSecrets(null)).toBeNull();
  expect(scrubSecrets(undefined)).toBeUndefined();
  expect(scrubSecrets(42)).toBe(42);
  expect(scrubSecrets({})).toEqual({});
});
