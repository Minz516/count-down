import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { describeEventList } from "../format";
import type { ToolContext } from "../registry";
import { runTool } from "./run-tool";

const inputSchema = z.object({
  from: z.string().optional().describe("Only events on or after this local date (YYYY-MM-DD). Default: now, so only upcoming events."),
  to: z.string().optional().describe("Only events on or before this local date (YYYY-MM-DD), the whole day included."),
  query: z.string().optional().describe("Plain text to look for in the event name or description."),
  limit: z.number().int().min(1).max(200).optional().describe("Most events to return. Default 50, at most 200."),
  timezone: z.string().optional().describe("IANA time zone for from/to and the times shown. Default Asia/Ho_Chi_Minh."),
});

export function registerListEvents(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "list_events",
    {
      title: "List events",
      description:
        "Lists the owner's personal events on the Countdown website, soonest first. By default only upcoming events. " +
        "Each line shows the local time, the id and the external_id, so the result can be used with update_event.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (input) =>
      runTool(context, async () => describeEventList(await context.events.listEvents(context.supabase, context.token, input))),
  );
}
