import type { TodoEntity } from "@/types/todo";

/** The todos module's DTO boundary - see modules/events/events.dto.ts's doc comment for
 * why this is a distinct type + mapper rather than reusing `TodoEntity` directly. */
export interface TodoDTO {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  is_done: boolean;
  position: number;
  created_at: string; // ISO timestamptz
}

export function toTodoDTO(entity: TodoEntity): TodoDTO {
  return { ...entity };
}

export function toTodoDTOs(entities: TodoEntity[]): TodoDTO[] {
  return entities.map(toTodoDTO);
}
