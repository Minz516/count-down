import { createHash, timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// SPIKE (tasks/todo.md T0): one read-only tool, no database. It exists to prove that mcp-handler
// runs in a Next.js route, that Claude Code can connect to it with a bearer token, and that the
// proxy exemption is exact. The real tools replace this in T6.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description: "Replies with pong. Used to check that the Countdown MCP server is reachable.",
        inputSchema: z.object({}),
      },
      async () => ({ content: [{ type: "text", text: "pong" }] }),
    );
  },
  { serverInfo: { name: "countdown", version: "0.0.0-spike" } },
);

/** Compares two secrets without leaking their length or content through timing. */
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Safe default: with no MCP_SPIKE_TOKEN configured every request is refused, so merging the spike
 * can never expose the endpoint. The response never echoes the token or says why it failed.
 */
async function authenticated(request: Request): Promise<Response> {
  const expected = process.env.MCP_SPIKE_TOKEN;
  const token = bearerToken(request);

  if (!expected || !token || !sameSecret(token, expected)) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  return handler(request);
}

export { authenticated as GET, authenticated as POST };
