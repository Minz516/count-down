import type { McpEventDTO } from "@/modules/mcpevents/mcpevents.interface";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * A short, plain answer for Claude to relay: what was stored, on which local clock, and the exact UTC
 * instant, so the owner can catch a wrong date or zone immediately.
 */
export function describeEvent(event: McpEventDTO): string {
  const verb = event.action === "created" ? "Created" : "Updated";
  const when = event.repeatsWeekly
    ? `every ${WEEKDAY_NAMES[event.dayOfWeek ?? 0]} at ${event.deadlineLocal.slice(11)}, next on ${event.deadlineLocal}`
    : event.deadlineLocal;

  const lines = [
    `${verb} "${event.name}" for ${when} (${event.timezone}; UTC ${event.deadlineUtc}).`,
    `id: ${event.id}${event.externalId ? `, external_id: ${event.externalId}` : ""}`,
  ];
  if (event.note) lines.push(`Note: ${event.note}`);
  return lines.join("\n");
}
