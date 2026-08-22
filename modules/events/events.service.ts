import type { SupabaseClient } from "@supabase/supabase-js";
import { eventsRepository } from "./events.repository";
import { getEventStatus } from "./events.status";
import { ValidationError } from "@/modules/shared/errors";
import type { EventInput, EventRecord } from "@/types/event";

export interface DashboardData {
  /** Non-recurring events, past+today+future together, ascending by deadline. */
  timeline: EventRecord[];
  recurring: EventRecord[];
  /** First non-past Timeline item, or null if there isn't one - also renders as the Hero Card. */
  nearestEvent: EventRecord | null;
}

/** Same shape as `DashboardData` - kept as a separate type since the two are populated by
 * different queries (personal vs. group-scoped) even though the fields line up. */
export type GroupDashboardData = DashboardData;

/**
 * Re-validates what the form already checked client-side (docs/ARCHITECTURE_DESIGN.md
 * §2.3: "controllers assume already-valid input", but the service layer is the
 * boundary that must not trust its caller blindly).
 */
function assertValidInput(input: EventInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Name is required.");
  }
  if (!input.deadline) {
    throw new ValidationError("Deadline is required.");
  }
  if (input.is_recurring && input.recurrence_day_of_week === null) {
    throw new ValidationError("A recurring event needs a day of week.");
  }
}

export const eventsService = {
  async getDashboardData(supabase: SupabaseClient, userId: string): Promise<DashboardData> {
    // Two independent queries per docs/ARCHITECTURE.md: the Timeline never
    // includes recurring events, and the recurring section never joins the
    // Timeline's sort order.
    const [timeline, recurring] = await Promise.all([
      eventsRepository.listByRecurrence(supabase, userId, false),
      eventsRepository.listByRecurrence(supabase, userId, true),
    ]);

    const nearestEvent =
      timeline.find((event) => getEventStatus(event.deadline).status !== "past") ?? null;

    return { timeline, recurring, nearestEvent };
  },

  createEvent(supabase: SupabaseClient, userId: string, input: EventInput): Promise<EventRecord> {
    assertValidInput(input);
    return eventsRepository.insert(supabase, userId, input);
  },

  updateEvent(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    input: EventInput,
  ): Promise<EventRecord> {
    assertValidInput(input);
    return eventsRepository.update(supabase, userId, id, input);
  },

  deleteEvent(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return eventsRepository.remove(supabase, userId, id);
  },

  // --- Group-scoped variants (docs/ARCHITECTURE.md "Group Countdown") ---

  async getGroupDashboardData(supabase: SupabaseClient, groupId: string): Promise<GroupDashboardData> {
    const [timeline, recurring] = await Promise.all([
      eventsRepository.listByGroupAndRecurrence(supabase, groupId, false),
      eventsRepository.listByGroupAndRecurrence(supabase, groupId, true),
    ]);

    const nearestEvent =
      timeline.find((event) => getEventStatus(event.deadline).status !== "past") ?? null;

    return { timeline, recurring, nearestEvent };
  },

  createGroupEvent(
    supabase: SupabaseClient,
    actingUserId: string,
    groupId: string,
    input: EventInput,
  ): Promise<EventRecord> {
    assertValidInput(input);
    return eventsRepository.insertGroupEvent(supabase, actingUserId, groupId, input);
  },

  updateGroupEvent(
    supabase: SupabaseClient,
    groupId: string,
    id: string,
    input: EventInput,
  ): Promise<EventRecord> {
    assertValidInput(input);
    return eventsRepository.updateGroupEvent(supabase, groupId, id, input);
  },

  deleteGroupEvent(supabase: SupabaseClient, groupId: string, id: string): Promise<void> {
    return eventsRepository.removeGroupEvent(supabase, groupId, id);
  },
};
