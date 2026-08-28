/** A row from the `todos` table (see docs/ARCHITECTURE.md). Repository-internal - see
 * modules/todos/todos.dto.ts for the DTO pages/components actually consume. */
export interface TodoEntity {
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
