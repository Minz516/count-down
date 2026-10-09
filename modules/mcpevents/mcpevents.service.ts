import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TIME, DEFAULT_TIMEZONE, nextWeeklyOccurrence, toUtcInstant, weekdayIn } from "@/lib/mcp/time";
import { AppError, DatabaseError, ValidationError } from "@/modules/shared/errors";
import type { DayOfWeek } from "@/types/event";
import type { McpCreateEventArgs, McpCreateEventInput, McpListEventsInput, McpUpdateEventInput } from "@/types/mcpevent";
import { toMcpEventDTO, toMcpEventListDTO, type McpEventDTO, type McpEventListDTO } from "./mcpevents.dto";
import { mcpEventsRepository } from "./mcpevents.repository";

/**
 * Turns what the database raised into something safe to show Claude and the owner. Anything not recognised
 * becomes a generic message: raw database text can carry internals, and nothing here may ever echo a token.
 */
function toSafeError(error: DatabaseError): AppError {
  const message = error.message;
  if (message === "Invalid token") return new AppError("invalid_token", "Invalid token");
  if (message === "Rate limit reached") {
    return new AppError("rate_limited", "Rate limit reached, try again in a minute");
  }
  if (message.startsWith("Too many events")) {
    return new AppError("rate_limited", "You are creating events too quickly, please wait a moment and try again");
  }
  if (message === "Event not found") return new AppError("not_found", "Event not found");
  if (/^Invalid input: [\w ]+$/.test(message)) return new ValidationError(message);
  return new AppError("unexpected", "Something went wrong while saving the event");
}

export const mcpEventsService = {
  /**
   * Creates the event, or updates the one with the same `externalId`. The local date, time and zone are
   * converted to a UTC instant here, before any database call, so a bad date is refused without spending
   * a token check or a rate-limit call.
   */
  async createEvent(
    supabase: SupabaseClient,
    token: string,
    input: McpCreateEventInput,
    now: Date = new Date(),
  ): Promise<McpEventDTO> {
    const time = input.time ?? DEFAULT_TIME;
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    const repeatsWeekly = input.repeatsWeekly === true;

    let deadline: string;
    let dayOfWeek: DayOfWeek | null = null;

    if (repeatsWeekly) {
      // "Every Monday": the weekday comes from `dayOfWeek`, or from `date` when only a date was given.
      if (input.dayOfWeek !== undefined) {
        dayOfWeek = input.dayOfWeek;
      } else if (input.date !== undefined) {
        dayOfWeek = weekdayIn(toUtcInstant({ date: input.date, time, timezone }).utc, timezone);
      } else {
        throw new ValidationError("Invalid input: day of week");
      }
      deadline = nextWeeklyOccurrence({ dayOfWeek, time, timezone, from: now });
    } else {
      if (input.date === undefined) throw new ValidationError("Invalid input: date");
      deadline = toUtcInstant({ date: input.date, time, timezone }).utc;
    }

    const args: McpCreateEventArgs = {
      name: input.name,
      deadline,
      description: input.description?.trim() ? input.description.trim() : null,
      externalId: input.externalId ?? null,
      isRecurring: repeatsWeekly,
      recurrenceDayOfWeek: dayOfWeek,
    };

    let entity;
    try {
      entity = await mcpEventsRepository.createEvent(supabase, token, args);
    } catch (error) {
      if (error instanceof DatabaseError) throw toSafeError(error);
      throw error;
    }

    const isPast = !repeatsWeekly && new Date(entity.event.deadline).getTime() < now.getTime();
    return toMcpEventDTO(entity, timezone, isPast ? "This date is in the past." : undefined);
  },

  /**
   * Changes the fields that were given on one existing personal event. A new deadline needs a `date`
   * (a bare `time` would silently guess the day), except for weekly events where the weekday sets it.
   */
  async updateEvent(
    supabase: SupabaseClient,
    token: string,
    input: McpUpdateEventInput,
    now: Date = new Date(),
  ): Promise<McpEventDTO> {
    if ((input.id === undefined) === (input.externalId === undefined)) throw new ValidationError("Invalid input: target");

    const time = input.time ?? DEFAULT_TIME;
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    const patch: Record<string, unknown> = {};

    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description?.trim() ? input.description.trim() : null;

    if (input.repeatsWeekly === true) {
      let dayOfWeek: DayOfWeek;
      if (input.dayOfWeek !== undefined) dayOfWeek = input.dayOfWeek;
      else if (input.date !== undefined) dayOfWeek = weekdayIn(toUtcInstant({ date: input.date, time, timezone }).utc, timezone);
      else throw new ValidationError("Invalid input: day of week");
      patch.is_recurring = true;
      patch.recurrence_day_of_week = dayOfWeek;
      patch.deadline = nextWeeklyOccurrence({ dayOfWeek, time, timezone, from: now });
    } else {
      if (input.dayOfWeek !== undefined) throw new ValidationError("Invalid input: repeats weekly");
      if (input.repeatsWeekly === false) patch.is_recurring = false;
      if (input.date !== undefined) {
        patch.deadline = toUtcInstant({ date: input.date, time, timezone }).utc;
      } else if (input.time !== undefined) {
        throw new ValidationError("Invalid input: date");
      }
    }

    if (Object.keys(patch).length === 0) throw new ValidationError("Invalid input: patch");

    let entity;
    try {
      entity = await mcpEventsRepository.updateEvent(supabase, token, {
        id: input.id ?? null,
        externalId: input.externalId ?? null,
        patch,
      });
    } catch (error) {
      if (error instanceof DatabaseError) throw toSafeError(error);
      throw error;
    }

    const isPast =
      "deadline" in patch && !entity.event.is_recurring && new Date(entity.event.deadline).getTime() < now.getTime();
    return toMcpEventDTO(entity, timezone, isPast ? "This date is in the past." : undefined);
  },

  /** Upcoming personal events by default. `from`/`to` are local dates; `to` includes the whole day. */
  async listEvents(supabase: SupabaseClient, token: string, input: McpListEventsInput = {}): Promise<McpEventListDTO> {
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1)) {
      throw new ValidationError("Invalid input: limit");
    }

    const from = input.from === undefined ? null : toUtcInstant({ date: input.from, time: "00:00", timezone }).utc;
    // The end of the local day: 23:59 plus 59.999 seconds, so an event at 23:59 is included.
    const to =
      input.to === undefined
        ? null
        : new Date(new Date(toUtcInstant({ date: input.to, time: "23:59", timezone }).utc).getTime() + 59_999).toISOString();
    const query = input.query?.trim() ? input.query.trim() : null;

    let entity;
    try {
      entity = await mcpEventsRepository.listEvents(supabase, token, { from, to, query, limit: input.limit ?? null });
    } catch (error) {
      if (error instanceof DatabaseError) throw toSafeError(error);
      throw error;
    }
    return toMcpEventListDTO(entity, timezone);
  },
};
