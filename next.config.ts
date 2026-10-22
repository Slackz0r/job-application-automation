import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repository's hand-maintained collaboration instructions unchanged.
  agentRules: false,
  // Authorization codes arrive in the callback query; keep them out of dev logs.
  logging: { incomingRequests: { ignore: [/\/auth\/callback/] } },
  // The private profile is supplied locally, not packaged with server output.
  outputFileTracingExcludes: {
    "/*": ["./professional-profile.json", "./data/chatgpt-registration.json*"],
  },
};

export default nextConfig;
