import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { SessionMembership } from "@/types";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
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
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordMatch) {
          return null;
        }

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
      if (trigger === "update" && session?.activeCampaignId) {
        const membership = token.memberships?.find(
          (m) => m.campaignId === session.activeCampaignId
        );
        if (membership) {
          token.activeCampaignId = membership.campaignId;
          token.activeRole = membership.role;
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
      return session;
    },
  },
};
