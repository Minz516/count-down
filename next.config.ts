import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// next/image requires remote hostnames to be explicitly allow-listed - avatar
// images are served from Supabase Storage (a public URL under the project's
// own Supabase domain), not a local /public asset. Derived from the same env
// var lib/supabase/client.ts already uses, rather than hardcoding one
// project's hostname, so this doesn't silently break in a different Supabase
// project's environment.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }],
  },
};

// Uploads source maps to Sentry on build so stack traces are readable - only actually runs
// when SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT are set (see .env.local.example); the
// wrapper itself is a safe no-op build-time step otherwise (docs/PRODUCTION_READINESS_
// CHECKLIST.md §11), it doesn't require NEXT_PUBLIC_SENTRY_DSN to be set to compile.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
