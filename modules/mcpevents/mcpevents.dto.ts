import { formatLocal } from "@/lib/mcp/time";
import type { McpEventListEntity, McpEventResultEntity } from "@/types/mcpevent";

/** What the MCP tools return to Claude: both clocks, so the owner can see exactly what was stored. */
export interface McpEventDTO {
  action: "created" | "updated" | "deleted";
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

/** One row of a listing: like McpEventDTO but without an action, since nothing was changed. */
export type McpListedEventDTO = Omit<McpEventDTO, "action" | "note">;

export interface McpEventListDTO {
  events: McpListedEventDTO[];
  /** How many events matched in all; larger than events.length when the limit cut the list. */
  total: number;
  timezone: string;
}

export function toMcpEventListDTO(entity: McpEventListEntity, timezone: string): McpEventListDTO {
  return {
    total: entity.total,
    timezone,
    events: entity.events.map((event) => {
      const dto = toMcpEventDTO({ action: "updated", event }, timezone);
      return {
        id: dto.id,
        externalId: dto.externalId,
        name: dto.name,
        description: dto.description,
        deadlineUtc: dto.deadlineUtc,
        deadlineLocal: dto.deadlineLocal,
        timezone: dto.timezone,
        repeatsWeekly: dto.repeatsWeekly,
        dayOfWeek: dto.dayOfWeek,
      };
    }),
  };
}
