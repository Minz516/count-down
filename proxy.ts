import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/auth/callback" is included so the OAuth code-exchange request (proxy.ts runs before
// its Route Handler, at a point where no session exists yet) isn't redirected to /login
// before it gets a chance to run (app/auth/callback/route.ts).
const AUTH_ROUTES = ["/login", "/signup", "/auth/callback"];

/**
 * Refreshes the Supabase session cookie when needed and redirects based on
 * auth state: signed-out users are sent to /login (except on the auth routes
 * themselves), signed-in users are bounced away from /login and /signup.
 */
export async function proxy(request: NextRequest) {
  const isAuthRoute = AUTH_ROUTES.includes(request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  let userId: string | null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    // getClaims() verifies the access token's signature locally against the project's
    // cached JWKS (asymmetric signing keys) instead of a Supabase Auth round-trip like
    // getUser(), which cost ~250ms+ on every page request and RSC fetch. It still
    // refreshes an expired token via the refresh token (and stages the new cookies via
    // setAll above), so sessions keep rolling. Trade-off: a session revoked server-side
    // stays valid here until its access token expires - RLS remains the real boundary.
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims.sub ?? null;
  } catch (error) {
    // getClaims() normally resolves an invalid/expired session to { data: null } rather
    // than throwing, but a corrupted or oddly-shaped session cookie (e.g. after a long
    // idle period forces the first refresh in a while) can make the underlying cookie
    // parsing throw instead. Without this, that throw reaches the page's Server
    // Component render uncaught and Next.js shows a generic, unhelpful error screen
    // (minified React error #441) instead of just sending the user to sign in again.
    console.error("proxy: failed to resolve auth session", error);

    if (isAuthRoute) {
      // Already headed to /login (or mid OAuth callback) - let it proceed as signed-out
      // rather than redirect-looping.
      return NextResponse.next({ request });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    // Clear every Supabase auth cookie (including chunked "sb-...-auth-token.0/.1/..."
    // pieces) so the corrupted session can't keep tripping this same throw on every
    // subsequent request, including the very next one to /login.
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) {
        redirectResponse.cookies.delete(cookie.name);
      }
    }
    return redirectResponse;
  }

  if (!userId && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (userId && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Forward the id of the user this middleware already verified (getClaims()) so
  // protected pages can trust it instead of paying for a second getUser() round-trip
  // (docs/FIX_NAVIGATION_LATENCY.md). Safe to trust: this header is set here, on the
  // request, after JWT verification - a client-sent "x-user-id" can never survive since
  // this construction always overwrites the header set. Not a new auth boundary - RLS
  // still enforces all actual data access regardless of this header's value.
  if (userId) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", userId);
    // Rebuilding the response for the new request headers would otherwise drop any
    // refreshed session cookies setAll() already staged on `response` above - carry
    // them over explicitly so a token refresh on this request still sticks.
    const pendingCookies = response.cookies.getAll();
    response = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie);
    }
  }

  return response;
}

export const config = {
  // Excludes any path with a file extension (favicon.ico, logo.png, and any
  // other static asset under public/), not just the one file we happened to
  // have when this was first written - a request for a public asset should
  // never get redirected to /login just because the visitor isn't signed in.
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
