/**
 * The public contract for the `events` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from events.repository.ts
 * or events.service.ts directly, and never call `supabase.from("events")` themselves.
 */
export { eventsService as eventsInterface } from "./events.service";
export type { DashboardData, GroupDashboardData } from "./events.service";

export { getEventStatus } from "./events.status";
export type { EventStatus, EventStatusInfo } from "./events.status";

export { nextOccurrence, daysUntil } from "./events.recurrence";
