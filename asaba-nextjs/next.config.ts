import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.12.104"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
