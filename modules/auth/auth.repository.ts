import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError } from "@/modules/shared/errors";

export type OAuthProvider = "google" | "facebook" | "discord" | "github";

/**
 * All Supabase Auth calls live here - nothing outside this module calls
 * `supabase.auth.*` or `supabase.rpc("get_email_for_username", ...)` directly.
 * Business rules (username/password validation, username-or-email sign-in)
 * live in `auth.service.ts` - this file is data access only.
 */
export const authRepository = {
  async signInWithPassword(supabase: SupabaseClient, email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new AppError("auth_failed", error.message);
  },

  /** Returns whether a session was issued immediately - false when Supabase Auth's
   * "Confirm email" setting is on, since signUp() then returns a user but no session
   * until the confirmation link is clicked (a Dashboard toggle, not something this
   * codebase controls - see docs/PRODUCTION_READINESS_CHECKLIST.md §3). */
  async signUp(
    supabase: SupabaseClient,
    email: string,
    password: string,
    username: string,
  ): Promise<{ hasSession: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw new AppError("auth_failed", error.message);
    return { hasSession: data.session !== null };
  },

  /** Browser-only: supabase-js navigates the page to the provider's consent screen itself
   * (window.location.assign) once this resolves without error - no manual redirect needed. */
  async signInWithOAuth(supabase: SupabaseClient, provider: OAuthProvider, redirectTo: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw new AppError("auth_failed", error.message);
  },

  async signOut(supabase: SupabaseClient): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new AppError("auth_failed", error.message);
  },

  async getCurrentUser(supabase: SupabaseClient): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  /** `null` if no profile matches - a pre-existing account (no `profiles` row) or a typo. */
  async resolveEmailForUsername(supabase: SupabaseClient, username: string): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_email_for_username", { p_username: username });
    if (error) throw new AppError("auth_failed", error.message);
    return (data as string | null) ?? null;
  },
};
