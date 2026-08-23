import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/auth/callback" is included so the OAuth code-exchange request (proxy.ts runs before
// its Route Handler, at a point where no session exists yet) isn't redirected to /login
// before it gets a chance to run (app/auth/callback/route.ts).
const AUTH_ROUTES = ["/login", "/signup", "/auth/callback"];

/**
 * Refreshes the Supabase session cookie on every request and redirects based on
 * auth state: signed-out users are sent to /login (except on the auth routes
 * themselves), signed-in users are bounced away from /login and /signup.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = AUTH_ROUTES.includes(request.nextUrl.pathname);

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Forward the id of the user this middleware already verified via getUser() so
  // protected pages can trust it instead of paying for a second getUser() round-trip
  // (docs/FIX_NAVIGATION_LATENCY.md). Safe to trust: this header is set here, on the
  // request, after JWT verification - a client-sent "x-user-id" can never survive since
  // this construction always overwrites the header set. Not a new auth boundary - RLS
  // still enforces all actual data access regardless of this header's value.
  if (user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
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
