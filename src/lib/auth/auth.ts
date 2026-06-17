import {
  decryptToken,
  encryptToken,
  validateEncryptionKey,
} from "@/lib/crypto/token-cipher";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { encryptLinkedAccount } from "./link-account";
import { refreshGoogleAccessToken } from "./refresh-google-token";
import { lastSix, shouldAllowSignIn } from "./sign-in-guard";
import { getOrStartSessionRefresh } from "./token-refresh-singleflight";

// Fail fast on a missing / misconfigured encryption key. Without this, the
// per-request `encryptToken` call in the session callback throws, gets caught,
// and silently degrades to `session.error = "RefreshTokenError"` — which the
// user sees as "Session expired. Please sign in again." every hour even
// though the underlying problem is a server-side env-var gap (#315).
//
// Skipped during `next build`: page-data collection evaluates this module
// without runtime env vars and a throw here aborts the build. Production
// runtime still validates eagerly on server start (NEXT_PHASE is unset or
// "phase-production-server").
if (process.env.NEXT_PHASE !== "phase-production-build") {
  validateEncryptionKey();
}

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
    async signIn({ user, account }) {
      // Guard against issue #61: reject attempts to link a second
      // Google identity to a user that already has a different Google
      // account. Without this, the Prisma adapter creates a duplicate
      // row that the DB constraint will now reject, but we want a
      // cleaner user-facing failure than a raw Postgres error.
      //
      // user.id is only populated after the Prisma adapter has written
      // the User row. If it is absent this callback is running for a
      // fresh sign-up, so there are no existing accounts to check and
      // we short-circuit — do NOT remove this guard, or every new
      // sign-up will hit a prisma.account query against an undefined
      // userId.
      if (!account || !user.id) return true;

      const existingAccounts = await prisma.account.findMany({
        where: { userId: user.id, provider: account.provider },
        select: { provider: true, providerAccountId: true },
      });

      const decision = shouldAllowSignIn({
        account: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          type: account.type,
        },
        existingAccounts,
      });

      if (!decision.allow) {
        // userId alone is enough to trace the incident in the DB;
        // providerAccountIds are Google's opaque user identifiers and
        // qualify as PII once telemetry ships, so only emit a suffix
        // that's useful for distinguishing which of two similar IDs
        // was involved without leaking the full value.
        logger.event("GoogleAccountLinkRejected", {
          userId: user.id,
          provider: account.provider,
          existingProviderAccountIdSuffix: lastSix(
            decision.existingProviderAccountId
          ),
          incomingProviderAccountIdSuffix: lastSix(account.providerAccountId),
        });
        return false;
      }

      return true;
    },
    async session({ session, user }) {
      const [googleAccount] = await prisma.account.findMany({
        where: { userId: user.id, provider: "google" },
        orderBy: { expires_at: "desc" },
      });

      if (!googleAccount) {
        logger.log("No Google account found for user", { userId: user.id });
        return session;
      }

      // Delegated to refresh-session-tokens.ts so the classifier branching is
      // unit-testable in isolation (see __tests__/session-callback.test.ts).
      // Returns a terminal-error outcome only for genuine Google revocation /
      // missing refresh-token / undecryptable ciphertext — transient failures
      // leave the session untouched so the next callback retries (#315).
      //
      // Wrapped in the singleflight cache (#216) so concurrent session
      // callbacks for the same account collapse onto one OAuth round-trip and
      // one DB write instead of racing each other's `prisma.account.update`.
      const outcome = await getOrStartSessionRefresh(user.id, googleAccount, {
        prisma,
        refreshGoogleAccessToken,
        encryptToken,
        decryptToken,
        logger,
        googleClientId: process.env.GOOGLE_CLIENT_ID!,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      });

      if (outcome.kind === "terminal-error") {
        session.error = "RefreshTokenError";
      }

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
    // When @auth/prisma-adapter writes a newly linked OAuth account it stores
    // tokens in plaintext. `encryptLinkedAccount` re-encrypts them in place.
    // Extracted into its own module so it's unit-testable without booting
    // NextAuth (see src/lib/auth/__tests__/link-account.test.ts).
    async linkAccount({ account }) {
      await encryptLinkedAccount(account);
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
