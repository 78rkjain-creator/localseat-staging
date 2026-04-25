import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, recordFailedAttempt, resetAttempts } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/audit";
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
    emailVerified: boolean;
    verificationTokenExpiry: string | null;
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
    emailVerified: boolean;
    verificationTokenExpiry: string | null;
    sessionExpiresAt?: number; // Unix seconds — enforced per-role in proxy.ts
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 28800, // 8 hours (canvassers enforced to 4 h via sessionExpiresAt in proxy.ts)
  },

  jwt: {
    maxAge: 28800, // 8 hours
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

        // Resolve client IP from proxy headers for audit logging only.
        const forwarded = req?.headers?.["x-forwarded-for"];
        const ip =
          (Array.isArray(forwarded)
            ? forwarded[0]
            : forwarded?.split(",")[0]?.trim()) ??
          (req?.headers?.["x-real-ip"] as string | undefined) ??
          "unknown";

        // Rate limit is keyed by email so a single account cannot be
        // brute-forced from multiple IPs, and shared IPs (e.g. an office)
        // don't affect unrelated accounts.
        const emailKey = credentials.email.toLowerCase().trim();
        const { allowed } = checkRateLimit(emailKey);
        if (!allowed) {
          throw new Error(
            "Too many failed attempts. Please try again in 15 minutes."
          );
        }

        const user = await db.user.findUnique({
          where: { email: emailKey },
          include: {
            memberships: {
              include: { campaign: { select: { id: true, name: true } } },
            },
          },
        });

        if (!user || !user.isActive) {
          recordFailedAttempt(emailKey);
          await createAuditLog({
            action: "LOGIN_FAILED",
            entityType: "auth",
            entityId: emailKey,
            details: { reason: !user ? "user_not_found" : "account_inactive", ip },
          });
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordMatch) {
          recordFailedAttempt(emailKey);
          await createAuditLog({
            userId: user.id,
            action: "LOGIN_FAILED",
            entityType: "auth",
            entityId: user.id,
            details: { reason: "wrong_password", ip },
          });
          return null;
        }

        resetAttempts(emailKey);
        await createAuditLog({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "auth",
          entityId: user.id,
          details: { ip },
        });

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
          emailVerified: !!user.emailVerified,
          verificationTokenExpiry: user.verificationTokenExpiry?.toISOString() ?? null,
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
        token.emailVerified = !!user.emailVerified;
        token.verificationTokenExpiry = user.verificationTokenExpiry ?? null;

        // Auto-select the first campaign if only one membership exists
        if (user.memberships.length === 1) {
          token.activeCampaignId = user.memberships[0].campaignId;
          token.activeRole = user.memberships[0].role;
        } else {
          token.activeCampaignId = null;
          token.activeRole = null;
        }

        // Set per-role session expiry: 4 h for canvassers, 8 h for everyone else
        const nowSec = Math.floor(Date.now() / 1000);
        token.sessionExpiresAt = nowSec + (token.activeRole === "canvasser" ? 14400 : 28800);
      }

      // Handle campaign switching via session update
      if (trigger === "update" && session?.activeCampaignId && !session?.refreshMemberships) {
        const membership = token.memberships?.find(
          (m) => m.campaignId === session.activeCampaignId
        );
        if (membership) {
          token.activeCampaignId = membership.campaignId;
          token.activeRole = membership.role;
          // Reset expiry clock when role changes via campaign switch
          const nowSec = Math.floor(Date.now() / 1000);
          token.sessionExpiresAt = nowSec + (membership.role === "canvasser" ? 14400 : 28800);
        }
      }

      // After email verification: re-fetch emailVerified from DB and update token
      if (trigger === "update" && session?.refreshVerification && token.id) {
        const fresh = await db.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true },
        });
        if (fresh) {
          token.emailVerified = !!fresh.emailVerified;
          token.verificationTokenExpiry = null;
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
            // Reset expiry clock when campaign (and role) is set after membership refresh
            const nowSec = Math.floor(Date.now() / 1000);
            token.sessionExpiresAt = nowSec + (target.role === "canvasser" ? 14400 : 28800);
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
