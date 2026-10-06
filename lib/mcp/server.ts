import type { SupabaseClient } from "@supabase/supabase-js";
import { createMcpHandler } from "mcp-handler";
import type { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";
import { registerTools } from "./registry";

// Tokens are issued by create_api_token() as "cdt_" plus 64 lowercase hex characters. Anything else cannot be a
// real token, so it is refused here without spending a database call.
const TOKEN_FORMAT = /^cdt_[0-9a-f]{64}$/;

const INSTRUCTIONS = [
  "These tools manage events on the owner's Countdown website.",
  "1. Resolve relative dates such as \"tomorrow\" or \"next Friday\" to an absolute YYYY-MM-DD using today's date before calling a tool. If the date is ambiguous, ask the owner.",
  "2. Pass `time` only when the owner gave one. Otherwise omit it: the server uses 23:59 Asia/Ho_Chi_Minh. Pass `timezone` only when the owner names another zone.",
  "3. Always pass the stable `external_id` from the vault note when there is one, so repeating or correcting an event updates it instead of creating a duplicate.",
  "4. Tell the owner what was stored, using the local time from the result.",
].join("\n");

export interface McpRouteDeps {
  createClient: () => SupabaseClient;
  events: typeof mcpEventsInterface;
}

/** The bearer token from the Authorization header, or null if it is missing or malformed. Never logged. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  return match && TOKEN_FORMAT.test(match[1]) ? match[1] : null;
}

function reportUnexpected(error: unknown): void {
  // Loaded on first use so the endpoint does not pay for monitoring until something unexpected happens.
  void import("@sentry/nextjs").then((sentry) => sentry.captureException(error)).catch(() => undefined);
}

/**
 * The MCP endpoint as a plain `(Request) => Response` function, with its database and events module passed in
 * so tests can use fakes. A request without a well-formed token is refused with 401 before anything else
 * happens. Otherwise a handler is built per request with the token captured in the tools (stateless: no
 * sessions, and the token never has to be stored). Whether the token is valid is decided by the database
 * function each tool calls.
 */
export function createMcpRouteHandler(deps: McpRouteDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const token = bearerToken(request);
    if (!token) {
      return Response.json({ error: "Invalid token" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
    }

    const handler = createMcpHandler(
      (server) => {
        registerTools(server, {
          token,
          supabase: deps.createClient(),
          events: deps.events,
          onUnexpectedError: reportUnexpected,
        });
      },
      { serverInfo: { name: "countdown", version: "1.0.0" }, instructions: INSTRUCTIONS },
    );
    return handler(request);
  };
}
