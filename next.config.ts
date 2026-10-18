import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker uses a traced server; the existing PM2 deployment uses next start.
  output: process.env.CASHCOMPASS_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // CashCompass has no static/public content — every route is personalized,
  // request-time financial data behind the auth boundary. Cache Components
  // (and the partial prefetching it enables) is built for mixed static/
  // dynamic sites, so it buys nothing here while forcing a Suspense
  // boundary around every data read. Left off; revisit if a public/
  // marketing route is ever added.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
