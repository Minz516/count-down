import { createMcpRouteHandler } from "@/lib/mcp/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";

// The MCP endpoint (https://<site>/api/mcp). Claude Code calls it with a personal access token created in
// Settings. proxy.ts lets exactly this path through without a browser session; the token is the credential.
// All logic lives in lib/mcp/server.ts so it can be tested without a running app.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createMcpRouteHandler({ createClient: createAnonClient, events: mcpEventsInterface });

export { handle as GET, handle as POST };
