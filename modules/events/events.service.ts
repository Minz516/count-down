import type { SupabaseClient } from "@supabase/supabase-js";
import { eventsRepository } from "./events.repository";
import { getEventStatus } from "./events.status";
import { toEventDTO, toEventDTOs, type EventDTO } from "./events.dto";
import { ValidationError } from "@/modules/shared/errors";
import type { EventInput } from "@/types/event";

export interface DashboardData {
  /** Non-recurring events, past+today+future together, ascending by deadline. */
  timeline: EventDTO[];
  recurring: EventDTO[];
  /** First non-past Timeline item, or null if there isn't one - also renders as the Hero Card. */
  nearestEvent: EventDTO | null;
}

/** Same shape as `DashboardData` - kept as a separate type since the two are populated by
 * different queries (personal vs. group-scoped) even though the fields line up. */
export type GroupDashboardData = DashboardData;

// Mirrors the `events_name_length`/`events_description_length` check constraints added in
// supabase/migrations/20260822000000_production_readiness.sql - checked here first so a
// too-long input fails with a friendly ValidationError instead of a raw Postgres constraint
// violation surfacing as a DatabaseError.
const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Re-validates what the form already checked client-side (docs/ARCHITECTURE_DESIGN.md
 * §2.3: "controllers assume already-valid input", but the service layer is the
 * boundary that must not trust its caller blindly).
 */
function assertValidInput(input: EventInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Name is required.");
  }
  if (input.name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`Name must be ${NAME_MAX_LENGTH} characters or fewer.`);
  }
  if (input.description && input.description.length > DESCRIPTION_MAX_LENGTH) {
    throw new ValidationError(`Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`);
  }
  if (!input.deadline) {
    throw new ValidationError("Deadline is required.");
  }
  if (input.is_recurring && input.recurrence_day_of_week === null) {
    throw new ValidationError("A recurring event needs a day of week.");
  }
}

/**
 * Translates `check_event_creation_rate_limit()`'s raised exception
 * (supabase/schema.sql, docs/PRODUCTION_READINESS_CHECKLIST.md §8) into the friendly,
 * typed error the UI expects - same pattern as groups.service.ts's joinGroup. Any other
 * error passes through unchanged.
 */
function translateRateLimitError(err: unknown): Error {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("Too many events created recently")) {
    return new ValidationError("You're creating events too quickly - please wait a moment and try again.");
  }
  return err instanceof Error ? err : new Error(String(err));
}

export const eventsService = {
  async getDashboardData(supabase: SupabaseClient, userId: string): Promise<DashboardData> {
    // Two independent queries per docs/ARCHITECTURE.md: the Timeline never
    // includes recurring events, and the recurring section never joins the
    // Timeline's sort order.
    const [timelineEntities, recurringEntities] = await Promise.all([
      eventsRepository.listByRecurrence(supabase, userId, false),
      eventsRepository.listByRecurrence(supabase, userId, true),
    ]);
    const timeline = toEventDTOs(timelineEntities);
    const recurring = toEventDTOs(recurringEntities);

    const nearestEvent =
      timeline.find((event) => getEventStatus(event.deadline).status !== "past") ?? null;

    return { timeline, recurring, nearestEvent };
  },

  async createEvent(supabase: SupabaseClient, userId: string, input: EventInput): Promise<EventDTO> {
    assertValidInput(input);
    try {
      return toEventDTO(await eventsRepository.insert(supabase, userId, input));
    } catch (err) {
      throw translateRateLimitError(err);
    }
  },

  async updateEvent(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    input: EventInput,
  ): Promise<EventDTO> {
    assertValidInput(input);
    return toEventDTO(await eventsRepository.update(supabase, userId, id, input));
  },

  deleteEvent(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return eventsRepository.remove(supabase, userId, id);
  },

  // --- Group-scoped variants (docs/ARCHITECTURE.md "Group Countdown") ---

  async getGroupDashboardData(supabase: SupabaseClient, groupId: string): Promise<GroupDashboardData> {
    const [timelineEntities, recurringEntities] = await Promise.all([
      eventsRepository.listByGroupAndRecurrence(supabase, groupId, false),
      eventsRepository.listByGroupAndRecurrence(supabase, groupId, true),
    ]);
    const timeline = toEventDTOs(timelineEntities);
    const recurring = toEventDTOs(recurringEntities);

    const nearestEvent =
      timeline.find((event) => getEventStatus(event.deadline).status !== "past") ?? null;

    return { timeline, recurring, nearestEvent };
  },

  async createGroupEvent(
    supabase: SupabaseClient,
    actingUserId: string,
    groupId: string,
    input: EventInput,
  ): Promise<EventDTO> {
    assertValidInput(input);
    try {
      return toEventDTO(await eventsRepository.insertGroupEvent(supabase, actingUserId, groupId, input));
    } catch (err) {
      throw translateRateLimitError(err);
    }
  },

  async updateGroupEvent(
    supabase: SupabaseClient,
    groupId: string,
    id: string,
    input: EventInput,
  ): Promise<EventDTO> {
    assertValidInput(input);
    return toEventDTO(await eventsRepository.updateGroupEvent(supabase, groupId, id, input));
  },

  deleteGroupEvent(supabase: SupabaseClient, groupId: string, id: string): Promise<void> {
    return eventsRepository.removeGroupEvent(supabase, groupId, id);
  },
};
