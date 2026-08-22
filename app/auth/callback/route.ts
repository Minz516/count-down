import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth redirect target (Google/Facebook/Discord/GitHub) - exchanges the `code` query param
 * for a session. Reuses lib/supabase/server.ts's createClient(): its cookie-write try/catch
 * is only a no-op guard for the Server Component case (see its own comment) - in a Route
 * Handler, cookie writes actually persist, so the session is correctly saved here.
 *
 * Redirects to /login (not /) on any failure path - proxy.ts would otherwise bounce a
 * sessionless redirect to / straight back to /login anyway, silently, with no indication
 * of what went wrong.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (!code || providerError) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}
