import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError } from "@/modules/shared/errors";

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

  async signUp(supabase: SupabaseClient, email: string, password: string, username: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
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
