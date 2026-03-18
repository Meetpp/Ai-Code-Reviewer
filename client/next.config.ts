import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Proxy /api/* → Express server (server-to-server, no CORS)
  async rewrites() {
    const serverUrl = process.env.API_SERVER_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${serverUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
