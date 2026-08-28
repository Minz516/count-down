import type { GroupEntity, GroupSettingsEntity } from "@/types/group";

/**
 * The groups module's DTO boundary - see modules/events/events.dto.ts's doc comment for
 * why this is a distinct type + mapper rather than reusing the repository-internal entity
 * types directly. `GroupDTO` is also a genuine aggregation, not just a renamed mirror:
 * `preview_avatars` is filled in by groups.service.ts's `attachPreviewAvatars` (a
 * cross-module join with `profiles`) - groups.repository.ts never touches that table.
 */
export interface GroupDTO {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string; // ISO timestamptz
  member_count: number;
  /** First few members' avatar URLs (capped, oldest-joined first), for the Groups list
   * card facepile - a `null` entry means that member has no avatar set. */
  preview_avatars: (string | null)[];
}

export function toGroupDTO(entity: GroupEntity, previewAvatars: (string | null)[]): GroupDTO {
  return { ...entity, preview_avatars: previewAvatars };
}

/** One row of a group's member roster (docs/UI_SPEC.md "Group Dashboard" - Members) - a
 * join of a raw `group_members` row (groups.repository.ts's internal `MemberRow`) with
 * `profiles`, built in groups.service.ts's `listGroupMembers`. */
export interface GroupMemberDTO {
  user_id: string;
  /** `null` means no `profiles` row - a pre-existing account from before usernames existed. */
  username: string | null;
  avatar_url: string | null;
  joined_at: string; // ISO timestamptz
}

export interface GroupSettingsDTO {
  group_id: string;
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}

export function toGroupSettingsDTO(entity: GroupSettingsEntity): GroupSettingsDTO {
  return { ...entity };
}
