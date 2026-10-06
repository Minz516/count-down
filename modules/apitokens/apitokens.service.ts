import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, DatabaseError, NotAuthenticatedError, ValidationError } from "@/modules/shared/errors";
import type { ApiTokenInput } from "@/types/apitoken";
import {
  toApiTokenDTO,
  toCreatedApiTokenDTO,
  type ApiTokenDTO,
  type CreatedApiTokenDTO,
} from "./apitokens.dto";
import { apiTokensRepository } from "./apitokens.repository";

// Mirrors the limits enforced inside create_api_token() (supabase/migrations/20261006000000_mcp_tokens.sql).
const NAME_MAX_LENGTH = 60;

const GENERIC = "Something went wrong. Please try again.";

/** Maps what the database raised to messages that are safe and useful in the Settings screen. */
function toFriendlyError(error: DatabaseError): AppError {
  switch (error.message) {
    case "Token limit reached":
      return new ValidationError("You already have 10 active tokens. Revoke one first.");
    case "Token not found":
      return new ValidationError("That token was not found.");
    case "Not signed in":
      return new NotAuthenticatedError();
    case "Invalid input: name":
      return new ValidationError(`Token name must be 1 to ${NAME_MAX_LENGTH} characters.`);
    case "Invalid input: expiry":
      return new ValidationError("The expiry must be in the future.");
    default:
      return new AppError("unexpected", GENERIC);
  }
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DatabaseError) throw toFriendlyError(error);
    throw error;
  }
}

export const apiTokensService = {
  /** The user's tokens, newest first, with status computed against `now`. */
  listTokens(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<ApiTokenDTO[]> {
    return guarded(async () => {
      const rows = await apiTokensRepository.list(supabase, userId);
      return rows.map((row) => toApiTokenDTO(row, now));
    });
  },

  /** Creates a token. The returned value is the only time the plain token exists: show it once. */
  createToken(supabase: SupabaseClient, input: ApiTokenInput, now: Date = new Date()): Promise<CreatedApiTokenDTO> {
    const name = input.name.trim();
    if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
      return Promise.reject(new ValidationError(`Token name must be 1 to ${NAME_MAX_LENGTH} characters.`));
    }

    const expiresAt = input.expiresAt ?? null;
    if (expiresAt !== null) {
      const when = Date.parse(expiresAt);
      if (Number.isNaN(when) || when <= now.getTime()) {
        return Promise.reject(new ValidationError("The expiry must be in the future."));
      }
    }

    return guarded(async () => toCreatedApiTokenDTO(await apiTokensRepository.create(supabase, name, expiresAt)));
  },

  revokeToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
    if (!tokenId.trim()) return Promise.reject(new ValidationError("That token was not found."));
    return guarded(() => apiTokensRepository.revoke(supabase, tokenId));
  },
};
