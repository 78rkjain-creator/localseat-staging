import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      // 50MB to support large voter list imports (CSV/XLSX). Next.js does not
      // allow per-action limits — this applies globally. Moving file uploads
      // to dedicated API routes would allow a lower default. Acceptable for V1.
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
          // geolocation=(self): canvasser location features; payment=(self): Stripe Payment Request API
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=(self), payment=(self), usb=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-eval required by Next.js dev mode; unsafe-inline by Next.js inline scripts
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // blob: for Mapbox GL JS web workers; 'self' for /sw.js service worker
              "worker-src blob: 'self'",
              // events.mapbox.com: Mapbox tile analytics; api.stripe.com: Stripe API calls
              "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://api.stripe.com",
              "img-src 'self' data: blob: https://*.mapbox.com https://*.stripe.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Stripe Checkout and Elements run in iframes on js.stripe.com / hooks.stripe.com
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
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
