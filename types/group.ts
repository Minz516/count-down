/** A row from the `groups` table, annotated with a member count (see docs/ARCHITECTURE.md).
 * Repository-internal - see modules/groups/groups.dto.ts's `GroupDTO` (which adds
 * `preview_avatars`, a cross-module join `groups.repository.ts` never does itself) for the
 * shape pages/components actually consume. */
export interface GroupEntity {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string; // ISO timestamptz
  member_count: number;
}

/** A row from the `group_settings` table. Repository-internal - see
 * modules/groups/groups.dto.ts for the DTO pages/components actually consume. */
export interface GroupSettingsEntity {
  group_id: string;
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}

/** Fields the group Settings form collects; `group_id` is server-assigned. */
export interface GroupSettingsInput {
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}
