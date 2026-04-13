import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/people", "/voter-list", "/canvassing", "/follow-ups", "/outreach", "/donors", "/team", "/settings", "/campaigns"];

// Routes that are always public
const PUBLIC_PATHS = ["/login", "/api/auth"];

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // If authenticated user visits login, redirect to dashboard
    if (pathname === "/login" && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Canvassers are restricted to their own routes only
    if (token?.activeRole === "canvasser") {
      const canvasserAllowed = ["/dashboard", "/canvassing", "/api/auth", "/api/canvass"];
      const isAllowed = canvasserAllowed.some((p) => pathname.startsWith(p));
      if (!isAllowed && pathname !== "/select-campaign") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Always allow public paths
        if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
          return true;
        }

        // Require token for protected routes
        if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
          return !!token;
        }

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
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
  ],
};
