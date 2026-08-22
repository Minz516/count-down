/** A row from the `todos` table (see docs/ARCHITECTURE.md). */
export interface TodoRecord {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  is_done: boolean;
  position: number;
  created_at: string; // ISO timestamptz
}

/** The only field the checklist's "add item" input collects. */
export interface TodoInput {
  content: string;
}
