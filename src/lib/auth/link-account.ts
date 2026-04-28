import { encryptToken } from "@/lib/crypto/token-cipher";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Account } from "next-auth";

/**
 * Re-encrypt the tokens `@auth/prisma-adapter` just wrote in plaintext.
 *
 * NextAuth's PrismaAdapter stores OAuth tokens as-received during the initial
 * account link. This runs from `events.linkAccount` to immediately replace
 * those plaintext values with `v1:` envelopes. Non-fatal on failure: the
 * session-callback refresh flow re-encrypts on the next token refresh.
 */
export async function encryptLinkedAccount(account: Account): Promise<void> {
  if (account.provider !== "google") return;

  const data: {
    access_token?: string | null;
    refresh_token?: string | null;
    id_token?: string | null;
  } = {};
  if (account.access_token) {
    data.access_token = encryptToken(account.access_token);
  }
  if (account.refresh_token) {
    data.refresh_token = encryptToken(account.refresh_token);
  }
  if (account.id_token) {
    data.id_token = encryptToken(account.id_token);
  }
  if (Object.keys(data).length === 0) return;

  try {
    await prisma.account.update({
      data,
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
    });
  } catch (error) {
    // Non-fatal: log but don't block sign-in. Leaves plaintext in place;
    // callers reading via getAccessToken / getGoogleAccount handle plaintext
    // and the next token refresh will re-encrypt. Worst-case window is one
    // Google access-token lifetime (~1h) of plaintext at rest.
    logger.error(error as Error, {
      context: "LinkAccountEncryptionFailed",
      provider: account.provider,
    });
  }
}
