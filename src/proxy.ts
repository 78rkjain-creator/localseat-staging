import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

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

    // Authenticated users with no active campaign must complete onboarding
    if (token && !token.activeCampaignId && pathname !== "/onboarding/create-campaign") {
      return NextResponse.redirect(new URL("/onboarding/create-campaign", req.url));
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
          pathname.startsWith("/_next") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/icons") ||
          pathname === "/manifest.json"
        ) {
          return true;
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
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)",
  ],
};
