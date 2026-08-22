/** 0 = Sunday .. 6 = Saturday, matching Postgres `extract(dow from ...)`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A row from the `events` table (see docs/ARCHITECTURE.md). */
export interface EventRecord {
  id: string;
  user_id: string;
  name: string;
  deadline: string; // ISO timestamptz
  description: string | null;
  created_at: string; // ISO timestamptz
  is_recurring: boolean;
  recurrence_day_of_week: DayOfWeek | null;
  /** null = personal event, set = belongs to that group (docs/ARCHITECTURE.md "Group Countdown"). */
  group_id: string | null;
}

/** Fields the create/edit form collects; `user_id`/`id`/`created_at` are server-assigned. */
export interface EventInput {
  name: string;
  deadline: string; // ISO timestamptz
  description: string | null;
  is_recurring: boolean;
  recurrence_day_of_week: DayOfWeek | null;
}
