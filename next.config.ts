import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server from other devices on the office LAN
  // (dev-only setting; has no effect on production builds).
  allowedDevOrigins: ["192.168.18.191", "192.168.18.*"],
  experimental: {
    serverActions: {
      // Ticket attachments: 5 files x 5 MB + multipart overhead.
      // Next's default 1 MB would reject real screenshots before the action runs.
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
