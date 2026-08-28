import type { ProfileEntity } from "@/types/profile";

/** The profiles module's DTO boundary - see modules/events/events.dto.ts's doc comment
 * for why this is a distinct type + mapper rather than reusing `ProfileEntity` directly. */
export interface ProfileDTO {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string; // ISO timestamptz
}

export function toProfileDTO(entity: ProfileEntity): ProfileDTO {
  return { ...entity };
}

export function toProfileDTOMap(entities: Map<string, ProfileEntity>): Map<string, ProfileDTO> {
  return new Map(Array.from(entities, ([id, entity]) => [id, toProfileDTO(entity)]));
}
