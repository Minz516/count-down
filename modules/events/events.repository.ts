import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { EventInput, EventEntity } from "@/types/event";

/**
 * All Supabase access for the `events` table lives here - nothing outside this
 * module runs an `events` query directly (docs/ARCHITECTURE_DESIGN.md §2.1).
 *
 * Every method takes the acting user's id and filters on it explicitly, even
 * though Row Level Security (supabase/schema.sql) also enforces it. That's not
 * redundant ceremony: this project authenticates with the anon key plus the
 * user's own session, never a service-role/elevated credential, so RLS *is* a
 * real, independently-enforced boundary here - unlike the backend-with-a-
 * service-role scenario the pattern doc assumes. The explicit filter is
 * defense-in-depth (keeps this repository correct even if a policy is ever
 * misconfigured) and makes the scoping visible in the code, not just the DB.
 */
export const eventsRepository = {
  /** `.is("group_id", null)` guards against a group event the caller happens to have
   * authored themselves leaking into their personal timeline (docs/ARCHITECTURE.md
   * "Group Countdown") - without it, `user_id = userId` alone isn't enough to mean
   * "personal" once group events exist. */
  async listByRecurrence(
    supabase: SupabaseClient,
    userId: string,
    isRecurring: boolean,
  ): Promise<EventEntity[]> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .is("group_id", null)
      .eq("is_recurring", isRecurring)
      .order("deadline", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as EventEntity[];
  },

  async insert(supabase: SupabaseClient, userId: string, input: EventInput): Promise<EventEntity> {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...input, user_id: userId })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as EventEntity;
  },

  async update(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    input: EventInput,
  ): Promise<EventEntity> {
    const { data, error } = await supabase
      .from("events")
      .update(input)
      .eq("id", id)
      .eq("user_id", userId)
      .is("group_id", null)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as EventEntity;
  },

  async remove(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .is("group_id", null);
    if (error) throw new DatabaseError(error.message);
  },

  // --- Group-scoped variants (docs/ARCHITECTURE.md "Group Countdown") ---
  // Filtered by group_id, not user_id: any member has equal permission to
  // manage any event in a group they belong to (docs/PRD.md), not just events
  // they personally authored.

  async listByGroupAndRecurrence(
    supabase: SupabaseClient,
    groupId: string,
    isRecurring: boolean,
  ): Promise<EventEntity[]> {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("group_id", groupId)
      .eq("is_recurring", isRecurring)
      .order("deadline", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as EventEntity[];
  },

  async insertGroupEvent(
    supabase: SupabaseClient,
    actingUserId: string,
    groupId: string,
    input: EventInput,
  ): Promise<EventEntity> {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...input, user_id: actingUserId, group_id: groupId })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as EventEntity;
  },

  async updateGroupEvent(
    supabase: SupabaseClient,
    groupId: string,
    id: string,
    input: EventInput,
  ): Promise<EventEntity> {
    const { data, error } = await supabase
      .from("events")
      .update(input)
      .eq("id", id)
      .eq("group_id", groupId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as EventEntity;
  },

  async removeGroupEvent(supabase: SupabaseClient, groupId: string, id: string): Promise<void> {
    const { error } = await supabase.from("events").delete().eq("id", id).eq("group_id", groupId);
    if (error) throw new DatabaseError(error.message);
  },
};
