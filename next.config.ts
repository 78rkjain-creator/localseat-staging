import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/voter-list",
        destination: "/people/residents",
        permanent: true,
      },
      {
        source: "/voter-list/confirmed",
        destination: "/people/voters",
        permanent: true,
      },
      {
        source: "/voter-list/confirmed/:personId",
        destination: "/people/:personId",
        permanent: true,
      },
      {
        source: "/voter-list/new",
        destination: "/people/new",
        permanent: true,
      },
      {
        source: "/voter-list/duplicates",
        destination: "/people/duplicates",
        permanent: true,
      },
      {
        source: "/voter-list/export",
        destination: "/people/export",
        permanent: true,
      },
      {
        source: "/voter-list/:personId",
        destination: "/people/:personId",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security",  value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // blob: for Mapbox GL JS web workers; 'self' for /sw.js service worker
              "worker-src blob: 'self'",
              // events.mapbox.com: Mapbox tile analytics (suppresses CSP console errors)
              "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
              "img-src 'self' data: blob: https://*.mapbox.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",         value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
