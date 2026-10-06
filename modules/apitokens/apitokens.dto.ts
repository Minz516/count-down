import type { ApiTokenEntity, CreatedApiTokenEntity } from "@/types/apitoken";

export type ApiTokenStatus = "active" | "expired" | "revoked";

/** A token as listed in Settings. Never contains the token value or its hash. */
export interface ApiTokenDTO {
  id: string;
  name: string;
  /** First 8 characters, for recognising a token. Not a secret. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: ApiTokenStatus;
}

/** The one-time result of creating a token: the only moment the plain value is available. */
export interface CreatedApiTokenDTO {
  id: string;
  token: string;
  prefix: string;
  createdAt: string;
}

/** Revoked wins over expired: it is the stronger, deliberate fact. */
function statusOf(entity: ApiTokenEntity, now: Date): ApiTokenStatus {
  if (entity.revoked_at) return "revoked";
  if (entity.expires_at && new Date(entity.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

export function toApiTokenDTO(entity: ApiTokenEntity, now: Date): ApiTokenDTO {
  return {
    id: entity.id,
    name: entity.name,
    prefix: entity.token_prefix,
    createdAt: entity.created_at,
    lastUsedAt: entity.last_used_at,
    expiresAt: entity.expires_at,
    revokedAt: entity.revoked_at,
    status: statusOf(entity, now),
  };
}

export function toCreatedApiTokenDTO(entity: CreatedApiTokenEntity): CreatedApiTokenDTO {
  return { id: entity.id, token: entity.token, prefix: entity.token_prefix, createdAt: entity.created_at };
}
