import type { SupabaseClient } from "@supabase/supabase-js";
import { todosRepository } from "./todos.repository";
import { ValidationError } from "@/modules/shared/errors";
import type { TodoRecord } from "@/types/todo";

// Mirrors the `todos_content_length` check constraint added in
// supabase/migrations/20260822000000_production_readiness.sql.
const CONTENT_MAX_LENGTH = 500;

/** Splits one flat `listAllForUser` result into per-event lists - see docs/ARCHITECTURE.md. */
export function groupByEvent(todos: TodoRecord[]): Record<string, TodoRecord[]> {
  const grouped: Record<string, TodoRecord[]> = {};
  for (const todo of todos) {
    (grouped[todo.event_id] ??= []).push(todo);
  }
  return grouped;
}

export const todosService = {
  listAllForUser(supabase: SupabaseClient, userId: string): Promise<TodoRecord[]> {
    return todosRepository.listAllForUser(supabase, userId);
  },

  groupByEvent,

  addTodo(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    content: string,
    currentCount: number,
  ): Promise<TodoRecord> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new ValidationError("Checklist item can't be empty.");
    }
    if (trimmed.length > CONTENT_MAX_LENGTH) {
      throw new ValidationError(`Checklist item must be ${CONTENT_MAX_LENGTH} characters or fewer.`);
    }
    return todosRepository.insert(supabase, userId, eventId, trimmed, currentCount);
  },

  toggleTodo(supabase: SupabaseClient, userId: string, id: string, isDone: boolean): Promise<TodoRecord> {
    return todosRepository.setDone(supabase, userId, id, isDone);
  },

  deleteTodo(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return todosRepository.remove(supabase, userId, id);
  },
};
