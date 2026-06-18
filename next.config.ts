import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native module — must stay external to the server bundle
  serverExternalPackages: ["better-sqlite3"],
  // The app is opened at http://127.0.0.1:3000 (the loopback IP Spotify's
  // OAuth redirect requires), but the dev server initializes with `localhost`,
  // so Next treats 127.0.0.1 as a cross-origin host and blocks its requests
  // for dev-only assets (the client bundle / HMR). That silently prevents
  // client hydration, leaving recharts charts blank and toggles inert. Allow
  // the loopback origin so the client bundle loads and the app hydrates.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
