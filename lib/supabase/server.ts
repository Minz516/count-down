import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for use in Server Components / Route Handlers. Writing cookies
 * from a Server Component throws (Next.js only allows it from a Server Action or
 * Route Handler) — that's caught and ignored here because `middleware.ts` already
 * refreshes the session cookie on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component - safe to ignore, see doc comment above.
          }
        },
      },
    },
  );
}
