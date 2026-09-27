import type { NextConfig } from "next";

/**
 * Static export (CLAUDE.md rule 1–2): no server, no API routes, no server actions.
 * `next build` writes `out/`, which Vercel serves as static files.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
