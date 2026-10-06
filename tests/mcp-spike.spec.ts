import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mcp/route";
import { proxy } from "@/proxy";

// T0 spike checks that can run without a browser or a deployment:
//  - proxy.ts lets exactly /api/mcp through and still redirects everything else when signed out
//  - the route refuses requests without the right bearer token before doing anything else
//  - with the right token the MCP protocol works and lists the spike's one tool
// The deployed and Claude Code checks are manual (see tasks/todo.md T0).

const SPIKE_TOKEN = "cdt_spike_test_token_0123456789abcdef";

test.beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  process.env.MCP_SPIKE_TOKEN = SPIKE_TOKEN;
});

const url = (path: string) => `http://localhost:3000${path}`;

test.describe("proxy.ts", () => {
  test("lets exactly /api/mcp through without a session", async () => {
    const response = await proxy(new NextRequest(url("/api/mcp"), { method: "POST" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  for (const path of ["/", "/groups", "/settings", "/api/mcp/extra", "/api/mcpx", "/api/mcp/"]) {
    test(`still redirects signed-out requests for ${path} to /login`, async () => {
      const response = await proxy(new NextRequest(url(path)));

      expect(response.status).toBe(307);
      // A trailing slash on the request is kept on the redirect ("/login/"); both are the login page.
      const target = new URL(response.headers.get("location") ?? "", "http://localhost:3000").pathname;
      expect(target.replace(/\/$/, "")).toBe("/login");
    });
  }
});

test.describe("/api/mcp route", () => {
  const rpc = (method: string, params: Record<string, unknown> = {}, id = 1) =>
    JSON.stringify({ jsonrpc: "2.0", id, method, params });

  const post = async (headers: Record<string, string>, body: string) => {
    return POST(
      new Request(url("/api/mcp"), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
        body,
      }),
    );
  };

  test("returns 401 when the Authorization header is missing", async () => {
    const response = await post({}, rpc("tools/list"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/bearer/i);
    expect(await response.json()).toEqual({ error: "Invalid token" });
  });

  test("returns 401 for a wrong token and a malformed header, without echoing either", async () => {
    for (const header of ["Bearer cdt_wrong", "Bearer ", "Basic abc", "cdt_spike_test_token_0123456789abcdef"]) {
      const response = await post({ authorization: header }, rpc("tools/list"));
      expect(response.status, header).toBe(401);
      expect(await response.text()).not.toContain("cdt_");
    }
  });

  test("returns 401 when no spike token is configured, whatever the header says", async () => {
    const saved = process.env.MCP_SPIKE_TOKEN;
    delete process.env.MCP_SPIKE_TOKEN;
    try {
      const response = await post({ authorization: `Bearer ${SPIKE_TOKEN}` }, rpc("tools/list"));
      expect(response.status).toBe(401);
    } finally {
      process.env.MCP_SPIKE_TOKEN = saved;
    }
  });

  test("with the right token the protocol works and lists the ping tool", async () => {
    const response = await post(
      { authorization: `Bearer ${SPIKE_TOKEN}` },
      rpc("tools/list"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("ping");
  });

  test("calling ping returns pong", async () => {
    const response = await post(
      { authorization: `Bearer ${SPIKE_TOKEN}` },
      rpc("tools/call", { name: "ping", arguments: {} }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("pong");
  });
});
