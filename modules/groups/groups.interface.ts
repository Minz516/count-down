/**
 * The public contract for the `groups` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from groups.repository.ts,
 * groups.service.ts, group-settings.repository.ts, or group-settings.service.ts
 * directly, and never call `supabase.from("groups"|"group_members"|"group_settings")`
 * or `supabase.rpc(...)` themselves.
 */
export { groupsService as groupsInterface } from "./groups.service";
export { groupSettingsService as groupSettingsInterface } from "./group-settings.service";
export type { GroupRecord, GroupMemberRecord, GroupSettings, GroupSettingsInput } from "@/types/group";
