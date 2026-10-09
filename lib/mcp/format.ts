import type { McpEventDTO, McpEventListDTO } from "@/modules/mcpevents/mcpevents.interface";

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

/** A compact list for Claude to relay: one line per event with the local time, then the ids. */
export function describeEventList(list: McpEventListDTO): string {
  if (list.events.length === 0) return "No events found.";
  const lines = list.events.map((event) => {
    const when = event.repeatsWeekly
      ? `every ${WEEKDAY_NAMES[event.dayOfWeek ?? 0]} at ${event.deadlineLocal.slice(11)}, next on ${event.deadlineLocal}`
      : event.deadlineLocal;
    const ids = `id: ${event.id}${event.externalId ? `, external_id: ${event.externalId}` : ""}`;
    const extra = event.description ? ` - ${event.description}` : "";
    return `- "${event.name}" ${when}${extra} (${ids}; UTC ${event.deadlineUtc})`;
  });
  const header =
    list.total > list.events.length
      ? `Showing ${list.events.length} of ${list.total} events (${list.timezone}):`
      : `${list.total} event${list.total === 1 ? "" : "s"} (${list.timezone}):`;
  return [header, ...lines].join("\n");
}
