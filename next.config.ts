import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        // Primary sprite host — same PokeAPI/sprites repo, no rate limiting.
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/PokeAPI/**",
      },
      {
        // Kept for any legacy/direct raw URLs that slip through.
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/PokeAPI/sprites/**",
      },
    ],
  },
  // The custom Socket.IO dev server uses webpack (not Turbopack). Its file
  // watcher must ignore scratch/output dirs — e.g. Playwright MCP writes console
  // logs into .playwright-mcp on every message, which would otherwise trigger an
  // endless rebuild → log → rebuild feedback loop.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.playwright-mcp/**",
          "**/.superpowers/**",
          "**/docs/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
