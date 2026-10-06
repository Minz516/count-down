import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { DayOfWeek } from "@/types/event";
import { describeEvent } from "../format";
import type { ToolContext } from "../registry";
import { runTool } from "./run-tool";

const inputSchema = z.object({
  name: z.string().describe("The event name as it should read on the countdown, for example \"Passport appointment\"."),
  date: z
    .string()
    .optional()
    .describe("Local date as YYYY-MM-DD. Resolve words like tomorrow or next Friday to an absolute date first. Required unless repeats_weekly is true."),
  time: z
    .string()
    .optional()
    .describe("Local time as HH:mm (24 hour). Only pass it if the owner gave a time; otherwise omit it and the default 23:59 is used."),
  timezone: z
    .string()
    .optional()
    .describe("IANA time zone such as Asia/Ho_Chi_Minh. Only pass it if the owner named another zone; the default is Asia/Ho_Chi_Minh."),
  description: z.string().optional().describe("Optional extra detail."),
  external_id: z
    .string()
    .optional()
    .describe("Stable id for this event from the vault note (countdown_id). The same id updates the same event instead of creating a duplicate."),
  repeats_weekly: z.boolean().optional().describe("True for an event that repeats every week."),
  day_of_week: z
    .number()
    .int()
    .min(0)
    .max(6)
    .optional()
    .describe("For weekly events: 0 = Sunday ... 6 = Saturday. If omitted, the weekday of `date` is used."),
});

export function registerCreateEvent(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "create_event",
    {
      title: "Create event",
      description:
        "Creates an event on the owner's Countdown website, or updates it when the same external_id already exists. " +
        "A date alone becomes 23:59 Asia/Ho_Chi_Minh time. Returns what was stored with the local time and the exact UTC time.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (input) =>
      runTool(context, async () => {
        const event = await context.events.createEvent(context.supabase, context.token, {
          name: input.name,
          date: input.date,
          time: input.time,
          timezone: input.timezone,
          description: input.description,
          externalId: input.external_id,
          repeatsWeekly: input.repeats_weekly,
          dayOfWeek: input.day_of_week as DayOfWeek | undefined,
        });
        return describeEvent(event);
      }),
  );
}
