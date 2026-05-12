import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  // Tunnel Sentry events through our own domain. Ad blockers and many
  // corporate firewalls block direct sentry.io requests; tunnelling
  // proxies them via /monitoring so we don't lose error telemetry from
  // users on uBlock / Brave / strict network policies.
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  }
});
