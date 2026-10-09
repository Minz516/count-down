/**
 * The public contract for the `mcpevents` module: token-authenticated event calls used by the MCP route
 * (app/api/mcp/route.ts). Import from here only, never from the service, repository or dto directly,
 * and never call `supabase.rpc(...)` outside the modules tree.
 */
export { mcpEventsService as mcpEventsInterface } from "./mcpevents.service";
export type { McpEventDTO, McpEventListDTO, McpListedEventDTO } from "./mcpevents.dto";
export type { McpCreateEventInput, McpUpdateEventInput, McpListEventsInput } from "@/types/mcpevent";
