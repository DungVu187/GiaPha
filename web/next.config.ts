import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev/e2e: chuyển /api/* sang NestJS để trình duyệt gọi cùng origin (prod: Nginx làm việc này).
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.API_URL ?? "http://localhost:4000"}/api/:path*` },
    ];
  },
};

export default nextConfig;
