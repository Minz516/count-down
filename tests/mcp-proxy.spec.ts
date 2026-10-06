import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

// proxy.ts must let exactly /api/mcp through (that route authenticates with its own bearer token) and keep
// every other route behind the normal sign-in redirect. Moved here from the T0 spike tests, unchanged in intent.

test.beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
});

const url = (path: string) => `http://localhost:3000${path}`;

test("lets exactly /api/mcp through without a session", async () => {
  const response = await proxy(new NextRequest(url("/api/mcp"), { method: "POST" }));

  expect(response.headers.get("location")).toBeNull();
  expect(response.status).toBe(200);
});

for (const path of ["/", "/groups", "/settings", "/api/mcp/extra", "/api/mcpx", "/api/mcp/", "/api/other"]) {
  test(`still redirects signed-out requests for ${path} to /login`, async () => {
    const response = await proxy(new NextRequest(url(path)));

    expect(response.status).toBe(307);
    // A trailing slash on the request is kept on the redirect ("/login/"); both are the login page.
    const target = new URL(response.headers.get("location") ?? "", "http://localhost:3000").pathname;
    expect(target.replace(/\/$/, "")).toBe("/login");
  });
}
