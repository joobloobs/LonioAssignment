import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lonio-poc/engine-core", "@lonio-poc/canton-zh"],
};

export default nextConfig;
