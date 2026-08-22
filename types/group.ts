/** A row from the `groups` table, annotated with a member count (see docs/ARCHITECTURE.md). */
export interface GroupRecord {
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

/** One row of a group's member roster (docs/UI_SPEC.md "Group Dashboard" - Members). */
export interface GroupMemberRecord {
  user_id: string;
  /** `null` means no `profiles` row - a pre-existing account from before usernames existed. */
  username: string | null;
  avatar_url: string | null;
  joined_at: string; // ISO timestamptz
}

/** A row from the `group_settings` table. */
export interface GroupSettings {
  group_id: string;
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}

/** Fields the group Settings form collects; `group_id` is server-assigned. */
export interface GroupSettingsInput {
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}
