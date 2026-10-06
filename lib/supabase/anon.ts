import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client with no user session and no cookies, for callers that authenticate some other way.
 * The MCP route (app/api/mcp/route.ts) is the one user: it forwards a personal access token to the
 * token-checked database functions, which decide who the caller is. `lib/supabase/server.ts` is for
 * browser sessions and reads cookies, so it cannot be used there.
 *
 * Uses the public anon key only. The service-role key must never be used in this app.
 */
export function createAnonClient(): SupabaseClient {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
