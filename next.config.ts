import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repository's hand-maintained collaboration instructions unchanged.
  agentRules: false,
  // The private profile is supplied locally, not packaged with server output.
  outputFileTracingExcludes: {
    "/*": ["./professional-profile.json"],
  },
};

export default nextConfig;
