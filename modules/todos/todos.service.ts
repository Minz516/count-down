import type { SupabaseClient } from "@supabase/supabase-js";
import { todosRepository } from "./todos.repository";
import { toTodoDTO, toTodoDTOs, type TodoDTO } from "./todos.dto";
import { ValidationError } from "@/modules/shared/errors";

// Mirrors the `todos_content_length` check constraint added in
// supabase/migrations/20260822000000_production_readiness.sql.
const CONTENT_MAX_LENGTH = 500;

/** Splits one flat `listAllForUser` result into per-event lists - see docs/ARCHITECTURE.md. */
export function groupByEvent(todos: TodoDTO[]): Record<string, TodoDTO[]> {
  const grouped: Record<string, TodoDTO[]> = {};
  for (const todo of todos) {
    (grouped[todo.event_id] ??= []).push(todo);
  }
  return grouped;
}

export const todosService = {
  async listAllForUser(supabase: SupabaseClient, userId: string): Promise<TodoDTO[]> {
    return toTodoDTOs(await todosRepository.listAllForUser(supabase, userId));
  },

  groupByEvent,

  async addTodo(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    content: string,
    currentCount: number,
  ): Promise<TodoDTO> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new ValidationError("Checklist item can't be empty.");
    }
    if (trimmed.length > CONTENT_MAX_LENGTH) {
      throw new ValidationError(`Checklist item must be ${CONTENT_MAX_LENGTH} characters or fewer.`);
    }
    return toTodoDTO(await todosRepository.insert(supabase, userId, eventId, trimmed, currentCount));
  },

  async toggleTodo(supabase: SupabaseClient, userId: string, id: string, isDone: boolean): Promise<TodoDTO> {
    return toTodoDTO(await todosRepository.setDone(supabase, userId, id, isDone));
  },

  deleteTodo(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return todosRepository.remove(supabase, userId, id);
  },
};
