const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EventStatus = "past" | "today" | "soon" | "later";

export interface EventStatusInfo {
  status: EventStatus;
  daysRemaining: number;
}

/**
 * Urgency status for a Timeline row, computed client-side from `deadline` vs.
 * `now`. Presentational only - it
 * never affects sort order or deletion, which run purely off the raw timestamp.
 *
 * Lives in the `events` module (not a generic `lib/` util) because it's events
 * business logic, not a formatting helper - it belongs next to the data it
 * describes, per the module-boundary rules.
 */
export function getEventStatus(deadline: string, now: Date = new Date()): EventStatusInfo {
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / MS_PER_DAY);

  if (diffMs < 0) {
    return { status: "past", daysRemaining };
  }

  if (deadlineDate.toDateString() === now.toDateString()) {
    return { status: "today", daysRemaining };
  }

  if (daysRemaining <= 7) {
    return { status: "soon", daysRemaining };
  }

  return { status: "later", daysRemaining };
}
