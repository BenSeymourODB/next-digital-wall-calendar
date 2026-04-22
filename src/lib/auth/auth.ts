import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { encryptLinkedAccount } from "./link-account";

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

          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: refreshTokenPlaintext,
            }),
          });

          const tokensOrError = await response.json();

          if (!response.ok) {
            throw tokensOrError;
          }

          const newTokens = tokensOrError as {
            access_token: string;
            expires_in: number;
            refresh_token?: string;
          };

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
