import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { describeEvent } from "../format";
import type { ToolContext } from "../registry";
import { runTool } from "./run-tool";

const inputSchema = z.object({
  id: z.string().optional().describe("The event id (from create_event or list_events). Give this OR external_id, not both."),
  external_id: z.string().optional().describe("The stable id from the vault note (countdown_id). Give this OR id, not both."),
  confirm: z
    .boolean()
    .optional()
    .describe("Must be true. Only pass true after the owner has explicitly said yes to deleting this event in this conversation."),
});

export function registerDeleteEvent(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "delete_event",
    {
      title: "Delete event",
      description:
        "PERMANENTLY deletes one event from the owner's Countdown website. Never call this without first asking the owner and getting a clear yes; " +
        "then pass confirm: true. Without it nothing is deleted. Returns what was deleted.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    (input) =>
      runTool(context, async () => {
        const event = await context.events.deleteEvent(context.supabase, context.token, {
          id: input.id,
          externalId: input.external_id,
          confirm: input.confirm,
        });
        return describeEvent(event);
      }),
  );
}
