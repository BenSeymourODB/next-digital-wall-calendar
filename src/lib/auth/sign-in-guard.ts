/**
 * Decides whether a NextAuth sign-in attempt should be allowed.
 *
 * Pure, side-effect-free, and deliberately separate from `auth.ts` so it can
 * be unit-tested without booting the NextAuth handler. Wired into
 * `callbacks.signIn` in `src/lib/auth/auth.ts`.
 *
 * The guard exists to close the bug in issue #61: without it, NextAuth's
 * Prisma adapter will happily create a second `Account` row for the same
 * user when a different Google identity signs in under an existing session,
 * which leaves `session()` stuck on a stale refresh token.
 */

type IncomingAccount = {
  provider: string;
  providerAccountId: string;
  type?: string | null;
} | null;

export type StoredAccount = {
  provider: string;
  providerAccountId: string;
};

export type SignInGuardInput = {
  account: IncomingAccount;
  existingAccounts: readonly StoredAccount[];
};

export type SignInGuardResult =
  | { allow: true }
  | { allow: false; reason: string; existingProviderAccountId: string };

/**
 * Return the last 6 characters of an opaque identifier (or the whole string
 * if it is shorter). Used when logging rejected sign-in attempts so the
 * structured event carries enough information to distinguish which of two
 * similar account IDs was involved, without emitting the full PII payload.
 */
export function lastSix(id: string): string {
  return id.length <= 6 ? id : id.slice(-6);
}

export function shouldAllowSignIn(input: SignInGuardInput): SignInGuardResult {
  const { account, existingAccounts } = input;

  if (!account) return { allow: true };

  const conflicting = existingAccounts.find(
    (existing) =>
      existing.provider === account.provider &&
      existing.providerAccountId !== account.providerAccountId
  );

  if (!conflicting) return { allow: true };

  return {
    allow: false,
    reason: `A ${account.provider} account is already linked to this user`,
    existingProviderAccountId: conflicting.providerAccountId,
  };
}
