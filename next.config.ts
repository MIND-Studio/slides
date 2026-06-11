import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone/server.js) for the prod
  // Docker image — see Dockerfile (target `web`) + docker-compose.prod.yml.
  output: "standalone",
  transpilePackages: ["@mind-studio/core", "@mind-studio/ui"],
};

export default nextConfig;
