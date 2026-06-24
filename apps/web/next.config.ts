import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  typedRoutes: true,
  async rewrites() {
    // Server-side only — not exposed to the browser. In production set API_URL
    // to the Railway backend URL (e.g. https://aeolus-api.up.railway.app).
    // The browser always calls same-origin /api/v1/*, Next.js proxies here.
    const backend = process.env.API_URL || "http://localhost:8000"
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
