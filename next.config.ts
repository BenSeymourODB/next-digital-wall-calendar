import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: false, // Disable Next.js compression - let Azure Front Door handle it
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  // Externalize packages with dynamic requires for server-side
  serverExternalPackages: ["applicationinsights"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
