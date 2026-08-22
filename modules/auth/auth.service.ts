import type { SupabaseClient } from "@supabase/supabase-js";
import { authRepository } from "./auth.repository";
import { ValidationError } from "@/modules/shared/errors";

export interface SignUpInput {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const authService = {
  /**
   * Validates the signup form's rules (docs/UI_SPEC.md "Login / Signup") before ever
   * calling Supabase - mirrors `events.service.ts`'s `assertValidInput` shape.
   */
  async signUp(supabase: SupabaseClient, input: SignUpInput): Promise<void> {
    const username = input.username.trim();
    const email = input.email.trim();

    if (!username) {
      throw new ValidationError("Username is required.");
    }
    if (!email) {
      throw new ValidationError("Email is required.");
    }
    if (input.password !== input.confirmPassword) {
      throw new ValidationError("Passwords do not match.");
    }

    try {
      await authRepository.signUp(supabase, email, input.password, username);
    } catch (err) {
      // Translates handle_new_user()'s raised Postgres exception (supabase/schema.sql)
      // into a friendly message - same pattern as groups.service.ts's joinGroup.
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Username already taken")) {
        throw new ValidationError("That username is already taken.");
      }
      throw err;
    }
  },

  /**
   * Signs in with either an email or a username (docs/UI_SPEC.md "Login / Signup") - an
   * "@" is treated as an email; anything else is resolved to an email first via
   * get_email_for_username() (supabase/schema.sql) before ever calling Supabase Auth.
   */
  async signInWithIdentifier(supabase: SupabaseClient, identifier: string, password: string): Promise<void> {
    const trimmed = identifier.trim();
    if (!trimmed) {
      throw new ValidationError("Enter your username or email.");
    }

    if (trimmed.includes("@")) {
      await authRepository.signInWithPassword(supabase, trimmed, password);
      return;
    }

    const email = await authRepository.resolveEmailForUsername(supabase, trimmed);
    if (!email) {
      // Deliberately generic - never confirm/deny whether a username exists, and
      // never reach Supabase Auth with a non-email string (which would surface a
      // distinct "invalid email format" error instead of this one).
      throw new ValidationError("Invalid username/email or password.");
    }

    await authRepository.signInWithPassword(supabase, email, password);
  },

  signOut(supabase: SupabaseClient): Promise<void> {
    return authRepository.signOut(supabase);
  },

  getCurrentUser: authRepository.getCurrentUser,
};
