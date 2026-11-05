import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Docker builds set NEXT_OUTPUT=standalone → a self-contained server in .next/standalone.
  // Left off otherwise so `npm start` keeps working.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  partialPrefetching: true,

  /**
   * How long data from Zabbix / Prometheus / Elasticsearch is reused between requests
   * (seconds). `revalidate` = refresh in the background after this long.
   */
  cacheLife: {
    live: { stale: 30, revalidate: 30, expire: 300 }, // problems, probes, logs
    ops: { stale: 60, revalidate: 300, expire: 3600 }, // throughput
    slow: { stale: 300, revalidate: 900, expire: 86400 }, // storage
    retry: { stale: 15, revalidate: 15, expire: 60 }, // a failed call is tried again soon
  },

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
