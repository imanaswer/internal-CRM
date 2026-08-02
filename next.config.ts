import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server from other devices on the office LAN
  // (dev-only setting; has no effect on production builds).
  allowedDevOrigins: ["192.168.18.191", "192.168.18.*"],
};

export default nextConfig;
