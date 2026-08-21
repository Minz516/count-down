const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The next future occurrence of a weekly-recurring event, computed client-side.
 * Mirrors the server-side rollover job (supabase/cleanup_and_rollover.sql) so the
 * UI always shows a future date even for the ~24h window before the daily cron
 * job has run and actually updated the stored `deadline`. Adding whole weeks
 * always preserves the original weekday, so this stays in sync with
 * `recurrence_day_of_week` without needing to look at it.
 */
export function nextOccurrence(deadline: string, now: Date = new Date()): Date {
  const deadlineMs = new Date(deadline).getTime();
  const nowMs = now.getTime();

  if (deadlineMs > nowMs) {
    return new Date(deadlineMs);
  }

  const weeksOverdue = Math.ceil((nowMs - deadlineMs) / MS_PER_WEEK);
  return new Date(deadlineMs + weeksOverdue * MS_PER_WEEK);
}

/** Whole days from `now` until `date`, floored at 0. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY));
}
