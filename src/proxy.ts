// IMPORTANT: This file MUST be named proxy.ts — do NOT rename it to middleware.ts.
// Next.js 16 uses proxy.ts as the auth/routing proxy convention.
// middleware.ts is deprecated in Next.js 16 (see: nextjs.org/docs/messages/middleware-to-proxy).
// Every other resource online will tell you to use middleware.ts — ignore them for this project.
// Renaming this file will break authentication and all route protection silently.

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Canvassers are restricted to these route prefixes — everything else redirects
// to /canvassing so they can't access voter data, donors, team, etc.
const CANVASSER_ALLOW_PREFIXES = [
  "/canvassing",
  "/dashboard",
  "/follow-ups",
  "/outreach",
  "/select-campaign",
  "/onboarding",
  "/account",
  "/verify-email",   // needed so unverified canvassers can complete verification
  "/api/auth",       // NextAuth internal routes (session refresh, signout, etc.)
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Demo site: redirect root to /demo (works for both authed and unauthed visitors).
    if (process.env.DEMO_MODE === "true" && pathname === "/") {
      return NextResponse.redirect(new URL("/demo", req.url));
    }

    // Authenticated users visiting /login are sent to the right landing page.
    if (pathname === "/login" && token) {
      const platformRole = token.platformRole;
      if (platformRole === "super_user" || platformRole === "super_admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Public routes have no token — nothing more to check.
    if (!token) {
      return NextResponse.next();
    }

    // All token property access below this point is safe (token is non-null).

    function redirect(dest: string) {
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // Canvasser deny-list — redirect to /canvassing for any disallowed route.
    if (token.activeRole === "canvasser") {
      const allowed = CANVASSER_ALLOW_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
      );
      if (!allowed) {
        return redirect("/canvassing");
      }
    }

    // /admin routes require a platform role of super_user or super_admin.
    if (pathname.startsWith("/admin")) {
      const { platformRole } = token;
      if (platformRole !== "super_user" && platformRole !== "super_admin") {
        return redirect("/dashboard");
      }
      return NextResponse.next();
    }

    // Platform users (super_user, super_admin) bypass campaign onboarding
    // and go straight to /admin.
    const { platformRole } = token;
    if (platformRole === "super_user" || platformRole === "super_admin") {
      if (!pathname.startsWith("/admin")) {
        return redirect("/admin");
      }
      return NextResponse.next();
    }

    // Email verification gate — skip for verification-related and auth paths.
    const skipVerificationCheck =
      pathname.startsWith("/verify-email") ||
      pathname === "/resend-verification" ||
      pathname === "/account-expired" ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/onboarding");

    if (!skipVerificationCheck && process.env.SKIP_EMAIL_VERIFICATION !== "true") {
      const { emailVerified, verificationTokenExpiry } = token;
      if (!emailVerified) {
        if (verificationTokenExpiry && new Date(verificationTokenExpiry) < new Date()) {
          return redirect("/account-expired");
        }
        return redirect("/verify-email/pending");
      }
    }

    // Authenticated users with no active campaign selected:
    // - Already at a campaign-selection page → let them through.
    // - Has existing memberships but none active → pick a campaign.
    // - No memberships at all → create a campaign.
    if (!token.activeCampaignId) {
      const atCampaignGate =
        pathname === "/onboarding/create-campaign" ||
        pathname === "/select-campaign" ||
        pathname.startsWith("/onboarding/choose-plan");

      if (!atCampaignGate) {
        const hasMemberships =
          Array.isArray(token.memberships) && token.memberships.length > 0;
        const dest = hasMemberships ? "/select-campaign" : "/onboarding/create-campaign";
        return redirect(dest);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // authorized is evaluated before the middleware function above.
      // Return true to run the middleware function; false redirects to signIn.
      authorized({ token, req }) {
        const pathname = req.nextUrl.pathname;

        // Public paths — always allow, no token required.
        if (
          pathname === "/" ||          // demo site redirects root → /demo in middleware
          pathname === "/login" ||
          pathname === "/register" ||
          pathname === "/demo" ||
          pathname === "/verify-email" ||
          pathname === "/resend-verification" ||
          pathname === "/account-expired" ||
          pathname === "/reset-password" ||
          pathname === "/sw.js" ||
          pathname === "/manifest.json" ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/api/auth") ||
          pathname === "/api/demo-leads" ||
          pathname === "/api/contact" ||
          pathname.startsWith("/icons")
        ) {
          return true;
        }

        // No token — not authenticated, redirect to login.
        if (!token) {
          return false;
        }

        // All token property access below this line is safe.

        // Verification pending requires auth but no campaign.
        if (pathname === "/verify-email/pending") {
          return true;
        }

        // Onboarding and campaign selection require auth but not an active campaign.
        if (
          pathname === "/onboarding/create-campaign" ||
          pathname === "/select-campaign"
        ) {
          return true;
        }

        // Admin routes require auth (platform-role check happens in middleware fn).
        if (pathname.startsWith("/admin")) {
          return true;
        }

        // All other app routes require a valid token.
        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (icons, manifest)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw\\.js).*)",
  ],
};
