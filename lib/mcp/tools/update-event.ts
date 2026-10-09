import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { DayOfWeek } from "@/types/event";
import { describeEvent } from "../format";
import type { ToolContext } from "../registry";
import { runTool } from "./run-tool";

const inputSchema = z.object({
  id: z.string().optional().describe("The event id (from create_event or list_events). Give this OR external_id, not both."),
  external_id: z.string().optional().describe("The stable id from the vault note (countdown_id). Give this OR id, not both."),
  name: z.string().optional().describe("New event name."),
  date: z
    .string()
    .optional()
    .describe("New local date as YYYY-MM-DD. Resolve words like tomorrow to an absolute date first. Needed to change the deadline of a one-off event."),
  time: z
    .string()
    .optional()
    .describe("Local time as HH:mm. Only pass it with a date (or for a weekly event) and only if the owner gave a time; otherwise 23:59 is used."),
  timezone: z.string().optional().describe("IANA time zone. Only pass it if the owner named another zone; the default is Asia/Ho_Chi_Minh."),
  description: z.string().nullable().optional().describe("New description. Pass null to clear it; omit to keep it."),
  repeats_weekly: z.boolean().optional().describe("true to make it repeat every week, false to make it a one-off event."),
  day_of_week: z.number().int().min(0).max(6).optional().describe("With repeats_weekly true: 0 = Sunday ... 6 = Saturday. If omitted, the weekday of `date` is used."),
});

export function registerUpdateEvent(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "update_event",
    {
      title: "Update event",
      description:
        "Changes one existing event on the owner's Countdown website. Name it by id or external_id, then pass only the fields to change; " +
        "everything else is kept. Fails with \"Event not found\" if there is no such event (use create_event for a new one).",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (input) =>
      runTool(context, async () => {
        const event = await context.events.updateEvent(context.supabase, context.token, {
          id: input.id,
          externalId: input.external_id,
          name: input.name,
          date: input.date,
          time: input.time,
          timezone: input.timezone,
          description: input.description,
          repeatsWeekly: input.repeats_weekly,
          dayOfWeek: input.day_of_week as DayOfWeek | undefined,
        });
        return describeEvent(event);
      }),
  );
}
