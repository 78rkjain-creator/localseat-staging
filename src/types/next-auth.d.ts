import type { DefaultSession, DefaultJWT } from "next-auth";
import type { Role, SessionMembership } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      memberships: SessionMembership[];
      activeCampaignId: string | null;
      activeRole: Role | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    firstName: string;
    lastName: string;
    memberships: SessionMembership[];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    firstName: string;
    lastName: string;
    memberships: SessionMembership[];
    activeCampaignId: string | null;
    activeRole: Role | null;
  }
}
