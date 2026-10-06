import { formatLocal } from "@/lib/mcp/time";
import type { McpEventResultEntity } from "@/types/mcpevent";

/** What the MCP tools return to Claude: both clocks, so the owner can see exactly what was stored. */
export interface McpEventDTO {
  action: "created" | "updated";
  id: string;
  externalId: string | null;
  name: string;
  description: string | null;
  /** ISO 8601 in UTC, as stored. */
  deadlineUtc: string;
  /** "YYYY-MM-DD HH:mm" in `timezone`, as the owner meant it. */
  deadlineLocal: string;
  timezone: string;
  repeatsWeekly: boolean;
  dayOfWeek: number | null;
  /** A heads-up that is not an error, for example that the date is already past. */
  note?: string;
}

export function toMcpEventDTO(entity: McpEventResultEntity, timezone: string, note?: string): McpEventDTO {
  const { event } = entity;
  const deadlineUtc = new Date(event.deadline).toISOString();
  return {
    action: entity.action,
    id: event.id,
    externalId: event.external_id,
    name: event.name,
    description: event.description,
    deadlineUtc,
    deadlineLocal: formatLocal(deadlineUtc, timezone),
    timezone,
    repeatsWeekly: event.is_recurring,
    dayOfWeek: event.recurrence_day_of_week,
    ...(note ? { note } : {}),
  };
}
