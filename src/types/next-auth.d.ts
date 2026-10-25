import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    // Optimistic hint for the proxy; the DAL re-checks onboarding_state.
    onboarded: boolean;
    admin: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    onboarded?: boolean;
    admin?: boolean;
  }
}
