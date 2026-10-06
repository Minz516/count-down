import { ValidationError } from "@/modules/shared/errors";
import type { DayOfWeek } from "@/types/event";

// Date and time handling for the MCP tools. The owner says "20 November" in Vietnam (UTC+7), the server
// runs in UTC, and the database stores an exact instant. Every conversion here names its time zone
// explicitly through Intl and never uses the runtime's own zone (unlike nextDeadlineForDayOfWeek in
// lib/dateFormat.ts, which is written for the browser and would pick the wrong weekday on a UTC server).

export const DEFAULT_TIME = "23:59";
export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const invalid = (field: string) => new ValidationError(`Invalid input: ${field}`);

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Throws `Invalid input: timezone` unless `timezone` is a time zone this runtime knows. */
function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timezone);
  if (cached) return cached;
  if (typeof timezone !== "string" || timezone.length === 0) throw invalid("timezone");
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    throw invalid("timezone");
  }
  formatters.set(timezone, formatter);
  return formatter;
}

interface Wall {
  year: number;
  month: number; // 1 to 12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading of an instant in a zone. */
function wallIn(instantMs: number, timezone: string): Wall {
  const wall: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") wall[part.type] = Number(part.value);
  }
  return { year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute, second: wall.second };
}

/** How far the zone's wall clock is ahead of UTC at that instant, in milliseconds. */
function offsetMs(instantMs: number, timezone: string): number {
  const wall = wallIn(instantMs, timezone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return wallAsUtc - (instantMs - (instantMs % 1000));
}

function parseDate(date: string): { year: number; month: number; day: number } {
  const match = typeof date === "string" ? DATE_PATTERN.exec(date) : null;
  if (!match) throw invalid("date");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Round-trip through Date.UTC to reject impossible days such as 31 February.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw invalid("date");
  }
  return { year, month, day };
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = typeof time === "string" ? TIME_PATTERN.exec(time) : null;
  if (!match) throw invalid("time");
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * The instant (ms) at which the zone's wall clock reads the given local date and time. A time that does not
 * exist (the hour skipped when daylight saving starts) is rejected. A time that happens twice (the hour
 * repeated when it ends) resolves to the first occurrence.
 */
function instantFor(
  { year, month, day }: { year: number; month: number; day: number },
  { hour, minute }: { hour: number; minute: number },
  timezone: string,
): number {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = offsetMs(asIfUtc, timezone);
  let instant = asIfUtc - firstOffset;
  const secondOffset = offsetMs(instant, timezone);
  if (secondOffset !== firstOffset) instant = asIfUtc - secondOffset;

  const back = wallIn(instant, timezone);
  if (back.year !== year || back.month !== month || back.day !== day || back.hour !== hour || back.minute !== minute) {
    throw invalid("time");
  }
  return instant;
}

export interface UtcInstant {
  /** ISO 8601 in UTC, what is stored in the database. */
  utc: string;
  /** "YYYY-MM-DD HH:mm" in the given zone, what the owner meant. */
  local: string;
  timezone: string;
}

/** Converts a local date (and optional time and zone) to the exact UTC instant. */
export function toUtcInstant({
  date,
  time = DEFAULT_TIME,
  timezone = DEFAULT_TIMEZONE,
}: {
  date: string;
  time?: string;
  timezone?: string;
}): UtcInstant {
  const parsedDate = parseDate(date);
  const parsedTime = parseTime(time);
  formatterFor(timezone);

  const instant = instantFor(parsedDate, parsedTime, timezone);
  return { utc: new Date(instant).toISOString(), local: formatLocal(new Date(instant).toISOString(), timezone), timezone };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "YYYY-MM-DD HH:mm" for an instant, as read on a clock in the zone. */
export function formatLocal(iso: string, timezone: string): string {
  const wall = wallIn(new Date(iso).getTime(), timezone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)} ${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** Day of the week (0 = Sunday .. 6 = Saturday) of an instant in the zone. */
export function weekdayIn(iso: string, timezone: string): DayOfWeek {
  const wall = wallIn(new Date(iso).getTime(), timezone);
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay() as DayOfWeek;
}

/**
 * ISO instant of the next occurrence (strictly after `from`) of the given weekday at the given local time in
 * the zone. If that weekday and time already passed today, it is next week. A weekly time that falls in a
 * daylight saving gap on the chosen day is rejected as `Invalid input: time` (the default zone has no DST).
 */
export function nextWeeklyOccurrence({
  dayOfWeek,
  time = DEFAULT_TIME,
  timezone = DEFAULT_TIMEZONE,
  from = new Date(),
}: {
  dayOfWeek: DayOfWeek;
  time?: string;
  timezone?: string;
  from?: Date;
}): string {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw invalid("day of week");
  const parsedTime = parseTime(time);
  formatterFor(timezone);

  const today = wallIn(from.getTime(), timezone);
  const todayWeekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const daysAhead = (dayOfWeek - todayWeekday + 7) % 7;

  const onDate = (extraDays: number) => {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + daysAhead + extraDays));
    return { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() };
  };

  let instant = instantFor(onDate(0), parsedTime, timezone);
  if (instant <= from.getTime()) instant = instantFor(onDate(7), parsedTime, timezone);
  return new Date(instant).toISOString();
}
