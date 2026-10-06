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

// MCP access tokens ("cdt_" plus 64 hex characters, see supabase/migrations/*_mcp_tokens.sql) are secrets too.
const MCP_TOKEN = "cdt_" + "0123456789abcdef".repeat(4);

test.describe("MCP access tokens", () => {
  test("a token is redacted wherever it appears, including inside an Authorization header value", () => {
    const event = {
      message: `rpc failed for ${MCP_TOKEN}`,
      request: { headers: { authorization: `Bearer ${MCP_TOKEN}`, "user-agent": "claude-code" } },
      breadcrumbs: [{ data: { url: `https://example.com/?t=${MCP_TOKEN}` } }],
    };

    const result = scrubSecrets(event);
    const text = JSON.stringify(result);

    expect(text).not.toContain(MCP_TOKEN);
    expect(text).not.toContain("0123456789abcdef0123456789abcdef");
    expect(result?.request.headers.authorization).toBe("Bearer [redacted]");
    expect(result?.request.headers["user-agent"]).toBe("claude-code");
    expect(result?.message).toBe("rpc failed for cdt_[redacted]");
  });

  test("any bearer value is redacted, even one that is not a well-formed token", () => {
    const result = scrubSecrets({ headers: { authorization: "Bearer some-other-secret-value" } });
    expect(result?.headers.authorization).toBe("Bearer [redacted]");
  });

  test("the short display prefix shown in Settings is not a secret and is left alone", () => {
    const result = scrubSecrets({ message: "token cdt_ab12cd34 was revoked" });
    expect(result?.message).toBe("token cdt_ab12cd34 was revoked");
  });

  test("webhook URLs and tokens are both redacted in one string", () => {
    const result = scrubSecrets({
      message: `${MCP_TOKEN} then https://discord.com/api/webhooks/123/secret-token`,
    });
    expect(result?.message).toBe("cdt_[redacted] then https://discord.com/api/webhooks/[redacted]");
  });
});
