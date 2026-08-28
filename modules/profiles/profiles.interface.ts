/**
 * The public contract for the `profiles` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from profiles.repository.ts
 * or profiles.service.ts directly, and never call `supabase.from("profiles")` or
 * `supabase.storage.from("avatars")` themselves.
 */
export { profilesService as profilesInterface } from "./profiles.service";
export type { ProfileDTO } from "./profiles.dto";
export type { ProfileInput } from "@/types/profile";
