import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  createDefaultTokenRefreshDeps,
  getOrStartTokenRefresh,
} from "./token-refresh";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/tasks",
          ].join(" "),
          access_type: "offline", // Request refresh token
          prompt: "consent", // Force consent to get refresh token
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Get the Google account for this user
      const [googleAccount] = await prisma.account.findMany({
        where: { userId: user.id, provider: "google" },
        orderBy: { expires_at: "desc" },
      });

      if (!googleAccount) {
        logger.log("No Google account found for user", { userId: user.id });
        return session;
      }

      // Access token expired? Refresh via the singleflight queue so
      // concurrent sessions don't all hit the Google OAuth endpoint.
      if (
        googleAccount.expires_at &&
        googleAccount.expires_at * 1000 < Date.now()
      ) {
        try {
          await getOrStartTokenRefresh(
            googleAccount,
            createDefaultTokenRefreshDeps()
          );
          logger.event("TokenRefreshed", {
            userId: user.id,
            success: true,
          });
        } catch (error) {
          logger.error(error as Error, {
            context: "TokenRefreshFailed",
            userId: user.id,
          });
          session.error = "RefreshTokenError";
        }
      }

      // Add user ID to session for easy access
      session.user.id = user.id;

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      logger.event("UserSignedIn", {
        userId: user.id ?? "unknown",
        email: user.email ?? "unknown",
        provider: account?.provider ?? "unknown",
        isNewUser: isNewUser ?? false,
      });
    },
    async signOut(message) {
      // Handle both session and token based signOut
      const userId =
        "session" in message
          ? (message.session as { userId?: string } | null)?.userId
          : "token" in message
            ? (message.token as { sub?: string } | null)?.sub
            : undefined;
      logger.event("UserSignedOut", {
        userId: userId ?? "unknown",
      });
    },
  },
});

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    error?: "RefreshTokenError";
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
