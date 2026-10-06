import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TIME, DEFAULT_TIMEZONE, nextWeeklyOccurrence, toUtcInstant, weekdayIn } from "@/lib/mcp/time";
import { AppError, DatabaseError, ValidationError } from "@/modules/shared/errors";
import type { DayOfWeek } from "@/types/event";
import type { McpCreateEventArgs, McpCreateEventInput } from "@/types/mcpevent";
import { toMcpEventDTO, type McpEventDTO } from "./mcpevents.dto";
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
};
