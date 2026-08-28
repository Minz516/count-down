import type { DayOfWeek, EventEntity } from "@/types/event";

/**
 * The events module's DTO boundary (docs/ARCHITECTURE_DESIGN.md §2.1) - pages/components
 * only ever see this shape, never `EventEntity` directly. Same fields as the entity today
 * (there's nothing sensitive to trim - RLS, not field-hiding, is this app's real security
 * boundary, see CLAUDE.md), but keeping it a distinct type with an explicit mapper means a
 * future `events` schema change is caught here instead of rippling into every component
 * that renders an event.
 */
export interface EventDTO {
  id: string;
  user_id: string;
  name: string;
  deadline: string; // ISO timestamptz
  description: string | null;
  created_at: string; // ISO timestamptz
  is_recurring: boolean;
  recurrence_day_of_week: DayOfWeek | null;
  /** null = personal event, set = belongs to that group (docs/ARCHITECTURE.md "Group Countdown"). */
  group_id: string | null;
}

export function toEventDTO(entity: EventEntity): EventDTO {
  return { ...entity };
}

export function toEventDTOs(entities: EventEntity[]): EventDTO[] {
  return entities.map(toEventDTO);
}
