import type { NextConfig } from "next";

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

export default nextConfig;
