import type { DayOfWeek } from "@/types/event";

/** The event row as returned by the mcp_* database functions (supabase/migrations/*_mcp_*.sql).
 * Repository-internal - modules/mcpevents/mcpevents.dto.ts is what callers consume. */
export interface McpEventRow {
  id: string;
  external_id: string | null;
  name: string;
  deadline: string; // ISO timestamptz
  description: string | null;
  is_recurring: boolean;
  recurrence_day_of_week: DayOfWeek | null;
  created_at: string; // ISO timestamptz
}

export interface McpEventResultEntity {
  action: "created" | "updated";
  event: McpEventRow;
}

/** What the repository sends to mcp_create_event: already converted to a UTC instant. */
export interface McpCreateEventArgs {
  name: string;
  deadline: string; // ISO UTC
  description: string | null;
  externalId: string | null;
  isRecurring: boolean;
  recurrenceDayOfWeek: DayOfWeek | null;
}

/** What a tool may send: friendly local date/time/zone, converted by the service. */
export interface McpCreateEventInput {
  name: string;
  /** YYYY-MM-DD, local to `timezone`. Required for one-off events; for weekly events it may stand in for `dayOfWeek`. */
  date?: string;
  /** HH:mm local, default 23:59. */
  time?: string;
  /** IANA zone, default Asia/Ho_Chi_Minh. */
  timezone?: string;
  description?: string | null;
  /** Stable id from the owner's vault; the same id updates the same event. */
  externalId?: string | null;
  repeatsWeekly?: boolean;
  dayOfWeek?: DayOfWeek;
}
