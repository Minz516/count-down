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
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "countdown-og",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
