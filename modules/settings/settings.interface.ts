/**
 * The public contract for the `settings` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from settings.repository.ts
 * or settings.service.ts directly, and never call `supabase.from("user_settings")` themselves.
 */
export { settingsService as settingsInterface } from "./settings.service";
export type { UserSettings, UserSettingsInput } from "@/types/settings";
