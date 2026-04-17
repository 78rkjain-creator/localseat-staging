import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Canvassers are restricted to these route prefixes — everything else redirects
// to /canvassing so they can't access voter data, donors, team, etc.
const CANVASSER_ALLOW_PREFIXES = [
  "/canvassing",
  "/select-campaign",
  "/onboarding",
  "/account",
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Temporary debug log — remove after diagnosing redirect loop
    console.log("[middleware]", pathname, "| token:", token
      ? JSON.stringify({
          id: (token as { id?: string }).id,
          emailVerified: (token as { emailVerified?: boolean }).emailVerified,
          activeCampaignId: (token as { activeCampaignId?: string | null }).activeCampaignId,
          activeRole: (token as { activeRole?: string | null }).activeRole,
          platformRole: (token as { platformRole?: string | null }).platformRole,
          membershipsCount: Array.isArray((token as { memberships?: unknown[] }).memberships)
            ? (token as { memberships: unknown[] }).memberships.length
            : "n/a",
        })
      : "null"
    );

    // Authenticated users visiting /login are sent to the right landing page
    // rather than being served the login form.
    if (pathname === "/login" && token) {
      const platformRole = (token as { platformRole?: string | null }).platformRole;
      if (platformRole === "super_user" || platformRole === "super_admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Canvasser deny-list — redirect to /canvassing for any disallowed route.
    const role = (token as { activeRole?: string | null } | null)?.activeRole ?? null;
    if (role === "canvasser") {
      const allowed = CANVASSER_ALLOW_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
      );
      if (!allowed) {
        return NextResponse.redirect(new URL("/canvassing", req.url));
      }
    }

    // /admin routes require a platform role of super_user or super_admin
    if (pathname.startsWith("/admin")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
      const platformRole = (token as { platformRole?: string | null }).platformRole;
      if (platformRole !== "super_user" && platformRole !== "super_admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // Platform users (super_user, super_admin) bypass campaign
    // onboarding and go straight to /admin
    const platformRole = (token as { platformRole?: string | null }).platformRole;
    if (platformRole === "super_user" || platformRole === "super_admin") {
      if (!pathname.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.next();
    }

    // Email verification gate — skip for verification-related and auth paths
    const skipVerificationCheck =
      pathname.startsWith("/verify-email") ||
      pathname === "/resend-verification" ||
      pathname === "/account-expired" ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/onboarding/choose-plan");

    if (token && !skipVerificationCheck) {
      const emailVerified = (token as { emailVerified?: boolean }).emailVerified;
      const verificationExpiry = (token as { verificationTokenExpiry?: string | null }).verificationTokenExpiry;

      if (!emailVerified) {
        if (verificationExpiry && new Date(verificationExpiry) < new Date()) {
          return NextResponse.redirect(new URL("/account-expired", req.url));
        }
        return NextResponse.redirect(new URL("/verify-email/pending", req.url));
      }
    }

    // Authenticated users with no active campaign selected:
    // - Already at a campaign-selection page → let them through
    // - Has existing memberships but none active → pick a campaign
    // - No memberships at all → create a campaign
    if (token && !token.activeCampaignId) {
      const atCampaignGate =
        pathname === "/onboarding/create-campaign" ||
        pathname === "/select-campaign";

      if (!atCampaignGate) {
        const hasMemberships =
          Array.isArray((token as { memberships?: unknown[] }).memberships) &&
          (token as { memberships: unknown[] }).memberships.length > 0;
        const dest = hasMemberships ? "/select-campaign" : "/onboarding/create-campaign";
        console.log("[middleware] no activeCampaignId — redirecting to", dest, "| hasMemberships:", hasMemberships);
        return NextResponse.redirect(new URL(dest, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // authorized is evaluated before the middleware function above.
      // Return true to run the middleware function; false redirects to signIn page.
      authorized({ token, req }) {
        const pathname = req.nextUrl.pathname;

        // Public routes — always accessible
        if (
          pathname === "/login" ||
          pathname === "/register" ||
          pathname === "/verify-email" ||
          pathname === "/resend-verification" ||
          pathname === "/account-expired" ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/icons") ||
          pathname === "/manifest.json" ||
          pathname === "/sw.js"
        ) {
          return true;
        }

        // Verification pending requires auth but no campaign
        if (pathname === "/verify-email/pending") {
          return !!token;
        }

        // Onboarding requires auth but not an active campaign
        if (pathname === "/onboarding/create-campaign") {
          return !!token;
        }

        // Admin routes require auth but not a campaign
        if (pathname.startsWith("/admin")) {
          return !!token;
        }

        // All other app routes require a valid token
        return !!token;
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
