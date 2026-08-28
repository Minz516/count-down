import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { TodoEntity } from "@/types/todo";

/**
 * All Supabase access for the `todos` table lives here - nothing outside this
 * module runs a `todos` query directly (docs/ARCHITECTURE_DESIGN.md §2.1).
 *
 * Every method takes the acting user's id and filters on it explicitly, same
 * defense-in-depth rationale as `events.repository.ts`.
 */
export const todosRepository = {
  /**
   * One query for every event's checklist at once, not one query per event
   * card - `todos.service.ts`'s `groupByEvent` then splits the result client-
   * side, mirroring how `events.repository.ts` avoids N+1 queries.
   */
  async listAllForUser(supabase: SupabaseClient, userId: string): Promise<TodoEntity[]> {
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .order("event_id", { ascending: true })
      .order("position", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as TodoEntity[];
  },

  async insert(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    content: string,
    position: number,
  ): Promise<TodoEntity> {
    const { data, error } = await supabase
      .from("todos")
      .insert({ event_id: eventId, user_id: userId, content, position })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as TodoEntity;
  },

  async setDone(supabase: SupabaseClient, userId: string, id: string, isDone: boolean): Promise<TodoEntity> {
    const { data, error } = await supabase
      .from("todos")
      .update({ is_done: isDone })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as TodoEntity;
  },

  async remove(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    const { error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new DatabaseError(error.message);
  },
};
