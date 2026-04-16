import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, recordFailedAttempt, resetAttempts } from "@/lib/rate-limit";
import type { SessionMembership } from "@/types";

// ── NextAuth type extensions ──────────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      memberships: SessionMembership[];
      activeCampaignId: string | null;
      activeRole: string | null;
      platformRole: string | null;
    };
  }
  interface User {
    id: string;
    firstName: string;
    lastName: string;
    memberships: SessionMembership[];
    platformRole?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    memberships: SessionMembership[];
    activeCampaignId: string | null;
    activeRole: string | null;
    platformRole: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 43200, // 12 hours
  },

  jwt: {
    maxAge: 43200, // 12 hours
  },

  // Pin the session cookie name and attributes explicitly so they are
  // consistent regardless of what NEXTAUTH_URL resolves to at runtime.
  // Without this, NextAuth derives the cookie name from NEXTAUTH_URL (using
  // "secure" prefix for https:// URLs), which can create a mismatch when
  // the server-side URL differs from the browser's origin (e.g. during
  // local mobile testing via LAN IP).
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Resolve client IP from proxy headers or fall back to "unknown"
        const forwarded = req?.headers?.["x-forwarded-for"];
        const ip =
          (Array.isArray(forwarded)
            ? forwarded[0]
            : forwarded?.split(",")[0]?.trim()) ??
          (req?.headers?.["x-real-ip"] as string | undefined) ??
          "unknown";

        const { allowed } = checkRateLimit(ip);
        if (!allowed) {
          throw new Error(
            "Too many login attempts. Please try again in 15 minutes."
          );
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: {
            memberships: {
              include: { campaign: { select: { id: true, name: true } } },
            },
          },
        });

        if (!user || !user.isActive) {
          recordFailedAttempt(ip);
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordMatch) {
          recordFailedAttempt(ip);
          return null;
        }

        resetAttempts(ip);

        const memberships: SessionMembership[] = user.memberships.map((m) => ({
          campaignId: m.campaign.id,
          campaignName: m.campaign.name,
          role: m.role,
        }));

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          memberships,
          platformRole: user.platformRole ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial sign-in, populate token from user object
      if (user) {
        token.id = user.id;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.memberships = user.memberships;
        token.platformRole = user.platformRole ?? null;

        // Auto-select the first campaign if only one membership exists
        if (user.memberships.length === 1) {
          token.activeCampaignId = user.memberships[0].campaignId;
          token.activeRole = user.memberships[0].role;
        } else {
          token.activeCampaignId = null;
          token.activeRole = null;
        }
      }

      // Handle campaign switching via session update
      if (trigger === "update" && session?.activeCampaignId && !session?.refreshMemberships) {
        const membership = token.memberships?.find(
          (m) => m.campaignId === session.activeCampaignId
        );
        if (membership) {
          token.activeCampaignId = membership.campaignId;
          token.activeRole = membership.role;
        }
      }

      // Handle new campaign creation: re-fetch full memberships from DB
      if (trigger === "update" && session?.refreshMemberships && token.id) {
        const user = await db.user.findUnique({
          where: { id: token.id as string },
          include: {
            memberships: {
              include: { campaign: { select: { id: true, name: true } } },
            },
          },
        });
        if (user) {
          const memberships: SessionMembership[] = user.memberships.map((m) => ({
            campaignId: m.campaign.id,
            campaignName: m.campaign.name,
            role: m.role,
          }));
          token.memberships = memberships;

          // Activate the requested campaign if provided, else auto-select if only one
          const targetId = session.activeCampaignId as string | undefined;
          const target = targetId
            ? memberships.find((m) => m.campaignId === targetId)
            : memberships.length === 1
            ? memberships[0]
            : null;

          if (target) {
            token.activeCampaignId = target.campaignId;
            token.activeRole = target.role;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.firstName = token.firstName;
      session.user.lastName = token.lastName;
      session.user.memberships = token.memberships ?? [];
      session.user.activeCampaignId = token.activeCampaignId ?? null;
      session.user.activeRole = token.activeRole ?? null;
      session.user.platformRole = token.platformRole ?? null;
      return session;
    },
  },
};
