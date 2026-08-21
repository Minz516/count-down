import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError } from "@/modules/shared/errors";

/**
 * All Supabase Auth calls live here - nothing outside this module calls
 * `supabase.auth.*` directly. There's no separate `auth.service.ts`: unlike
 * `events`, this module has no business rules of its own to layer on top -
 * Supabase Auth already owns password rules, session issuance, etc. A
 * model-less, passthrough module is a legitimate shape here, not a
 * placeholder (docs/ARCHITECTURE_DESIGN.md §2.1).
 */
export const authRepository = {
  async signInWithPassword(supabase: SupabaseClient, email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new AppError("auth_failed", error.message);
  },

  async signUp(supabase: SupabaseClient, email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password });
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
};
