/**
 * The public contract for the `settings` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from settings.repository.ts
 * or settings.service.ts directly, and never call `supabase.from("user_settings")` themselves.
 */
export { settingsService as settingsInterface } from "./settings.service";
export type { UserSettingsDTO } from "./settings.dto";
export type { UserSettingsInput } from "@/types/settings";

// Shared Discord helpers - also used by modules/groups' group-settings
// service, so both personal and group webhook settings validate/send
// identically instead of duplicating this logic.
export { postDiscordMessage, assertValidWebhook } from "./settings.discord";
