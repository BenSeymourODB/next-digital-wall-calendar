import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { encryptLinkedAccount } from "./link-account";
import { refreshGoogleAccessToken } from "./refresh-google-token";
import { lastSix, shouldAllowSignIn } from "./sign-in-guard";

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
      // Get the Google account for this user
      const [googleAccount] = await prisma.account.findMany({
        where: { userId: user.id, provider: "google" },
        orderBy: { expires_at: "desc" },
      });

      if (!googleAccount) {
        logger.log("No Google account found for user", { userId: user.id });
        return session;
      }

      // Check if access token has expired
      if (
        googleAccount.expires_at &&
        googleAccount.expires_at * 1000 < Date.now()
      ) {
        // Access token has expired, try to refresh it
        try {
          if (!googleAccount.refresh_token) {
            throw new Error("No refresh token available");
          }

          // Stored refresh_token may be a v1 envelope (encrypted) or a legacy
          // plaintext value written before this PR; decryptToken handles both.
          // Decryption can throw on tamper / GCM auth-tag mismatch / unknown
          // envelope version (e.g. after a key rotation). Surface that with a
          // distinct log context so operators can tell a cipher failure apart
          // from a Google-side refresh failure.
          let refreshTokenPlaintext: string | null;
          try {
            refreshTokenPlaintext = decryptToken(googleAccount.refresh_token);
          } catch (error) {
            logger.error(error as Error, {
              context: "RefreshTokenDecryptFailed",
              userId: user.id,
            });
            throw new Error(
              "Failed to decrypt stored refresh token (possible key rotation or tampering)"
            );
          }
          if (!refreshTokenPlaintext) {
            throw new Error("No refresh token available");
          }

          const newTokens = await refreshGoogleAccessToken(
            refreshTokenPlaintext,
            process.env.GOOGLE_CLIENT_ID!,
            process.env.GOOGLE_CLIENT_SECRET!
          );

          // Update tokens in database, encrypting at rest. Google only returns
          // a new refresh_token on the first consent or after revocation, so
          // fall back to re-encrypting the existing plaintext refresh token
          // when one isn't included in the response.
          await prisma.account.update({
            data: {
              access_token: encryptToken(newTokens.access_token),
              expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
              refresh_token: encryptToken(
                newTokens.refresh_token ?? refreshTokenPlaintext
              ),
            },
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: googleAccount.providerAccountId,
              },
            },
          });

          logger.event("TokenRefreshed", {
            userId: user.id,
            success: true,
          });
        } catch (error) {
          logger.error(error as Error, {
            context: "TokenRefreshFailed",
            userId: user.id,
          });
          // Return error so we can handle it on the client
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
