import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NextRequest } from "next/server";

// In development, NEXTAUTH_URL is set to http://localhost:3000 in .env.
// When accessing the app from a phone on the same LAN via the machine's IP
// (e.g. http://10.0.0.189:3000), NextAuth validates the callbackUrl against
// NEXTAUTH_URL and rejects it — causing the login to silently fail.
//
// Fix: override NEXTAUTH_URL with the actual request origin, then create a
// fresh NextAuth handler so NextAuth reads the updated env at instantiation
// time (not from a module-level singleton captured at startup).
// This override is development-only and has no effect in production.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handler(req: NextRequest, ctx: any) {
  if (process.env.NODE_ENV === "development") {
    const { protocol, host } = new URL(req.url);
    process.env.NEXTAUTH_URL = `${protocol}//${host}`;
  }
  return NextAuth(authOptions)(req, ctx);
}

export { handler as GET, handler as POST };
