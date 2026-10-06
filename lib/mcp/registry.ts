import type { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";
import { registerCreateEvent } from "./tools/create-event";

/** What every tool needs: the caller's token (never logged), a session-less database client, and the events module. */
export interface ToolContext {
  token: string;
  supabase: SupabaseClient;
  events: typeof mcpEventsInterface;
  /** Called with errors that are not part of normal use (not input or auth problems), for monitoring. */
  onUnexpectedError?: (error: unknown) => void;
}

/** One line per tool, one file per tool (lib/mcp/tools/), so slices add tools without touching each other. */
export function registerTools(server: McpServer, context: ToolContext): void {
  registerCreateEvent(server, context);
}
