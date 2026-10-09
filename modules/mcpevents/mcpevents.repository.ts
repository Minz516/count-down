import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { McpCreateEventArgs, McpDeleteEventArgs, McpEventListEntity, McpEventResultEntity, McpListEventsArgs, McpUpdateEventArgs } from "@/types/mcpevent";

/**
 * All Supabase access for the token-authenticated event calls. Unlike the other repositories these do
 * not filter by a user id: the user is never passed in. The database function derives the acting user
 * from the token itself, which is the whole point (and why the caller needs no session).
 */
export const mcpEventsRepository = {
  async createEvent(supabase: SupabaseClient, token: string, args: McpCreateEventArgs): Promise<McpEventResultEntity> {
    const { data, error } = await supabase.rpc("mcp_create_event", {
      p_token: token,
      p_name: args.name,
      p_deadline: args.deadline,
      p_description: args.description,
      p_external_id: args.externalId,
      p_is_recurring: args.isRecurring,
      p_recurrence_day_of_week: args.recurrenceDayOfWeek,
    });

    // The message is whatever the database function raised; it never contains the token. The service
    // decides what is safe to show.
    if (error) throw new DatabaseError(error.message);
    return data as McpEventResultEntity;
  },

  async updateEvent(supabase: SupabaseClient, token: string, args: McpUpdateEventArgs): Promise<McpEventResultEntity> {
    const { data, error } = await supabase.rpc("mcp_update_event", {
      p_token: token,
      p_id: args.id,
      p_external_id: args.externalId,
      p_patch: args.patch,
    });
    if (error) throw new DatabaseError(error.message);
    return data as McpEventResultEntity;
  },

  async listEvents(supabase: SupabaseClient, token: string, args: McpListEventsArgs): Promise<McpEventListEntity> {
    const { data, error } = await supabase.rpc("mcp_list_events", {
      p_token: token,
      p_from: args.from,
      p_to: args.to,
      p_query: args.query,
      p_limit: args.limit,
    });
    if (error) throw new DatabaseError(error.message);
    return data as McpEventListEntity;
  },

  /** Always sends p_confirm = true: the service has already refused anything else. */
  async deleteEvent(supabase: SupabaseClient, token: string, args: McpDeleteEventArgs): Promise<McpEventResultEntity> {
    const { data, error } = await supabase.rpc("mcp_delete_event", {
      p_token: token,
      p_id: args.id,
      p_external_id: args.externalId,
      p_confirm: true,
    });
    if (error) throw new DatabaseError(error.message);
    return data as McpEventResultEntity;
  },
};
