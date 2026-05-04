import { prisma as defaultPrisma } from "@/lib/db";

export type GoogleTokenAccount = {
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
};

export type RefreshedTokens = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type AccountUpdateInput = {
  where: {
    provider_providerAccountId: {
      provider: string;
      providerAccountId: string;
    };
  };
  data: {
    access_token: string;
    expires_at: number;
    refresh_token: string | null;
  };
};

type PrismaLike = {
  account: {
    update: (input: AccountUpdateInput) => Promise<unknown>;
  };
};

type LoggerLike = {
  dependency: (
    name: string,
    target: string,
    duration: number,
    success: boolean,
    resultCode?: number | string,
    type?: string
  ) => void;
};

export type TokenRefreshDeps = {
  fetch: typeof fetch;
  prisma: PrismaLike;
  clientId: string;
  clientSecret: string;
  now?: () => number;
  logger?: LoggerLike;
};

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

const inflight = new Map<string, Promise<RefreshedTokens>>();

function cacheKey(account: GoogleTokenAccount): string {
  return `${account.provider}:${account.providerAccountId}`;
}

/**
 * Performs the Google OAuth refresh-token round-trip and writes the new
 * access token (and rotated refresh token, if Google returned one) back to
 * the Account row. Pure function: every external dependency is injected so
 * the call is fully unit-testable.
 */
export async function refreshGoogleAccessToken(
  account: GoogleTokenAccount,
  deps: TokenRefreshDeps
): Promise<RefreshedTokens> {
  if (!account.refresh_token) {
    throw new Error("No refresh token available");
  }

  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  let response: Response;
  try {
    response = await deps.fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }).toString(),
    });
  } catch (err) {
    deps.logger?.dependency(
      "GoogleOAuthRefresh",
      GOOGLE_OAUTH_TOKEN_URL,
      now() - startedAt,
      false,
      "ERR"
    );
    throw err;
  }

  deps.logger?.dependency(
    "GoogleOAuthRefresh",
    GOOGLE_OAUTH_TOKEN_URL,
    now() - startedAt,
    response.ok,
    response.status
  );

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: `HTTP ${response.status}` };
    }
    throw Object.assign(new Error("Token refresh failed"), {
      cause: errorBody,
      status: response.status,
    });
  }

  const tokens = (await response.json()) as RefreshedTokens;

  await deps.prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    data: {
      access_token: tokens.access_token,
      expires_at: Math.floor(now() / 1000) + tokens.expires_in,
      refresh_token: tokens.refresh_token ?? account.refresh_token,
    },
  });

  return tokens;
}

/**
 * Singleflight wrapper around `refreshGoogleAccessToken`. Multiple
 * concurrent callers for the same `(provider, providerAccountId)` await
 * the same in-flight promise so only one OAuth round-trip is issued. The
 * cache slot is purged after the promise settles (success or failure) so
 * subsequent refreshes start fresh.
 */
export function getOrStartTokenRefresh(
  account: GoogleTokenAccount,
  deps: TokenRefreshDeps
): Promise<RefreshedTokens> {
  const key = cacheKey(account);
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const pending = refreshGoogleAccessToken(account, deps).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

/**
 * Reset the in-flight cache. Test-only helper — gated on NODE_ENV so an
 * accidental production call is a no-op.
 */
export function __resetTokenRefreshCache(): void {
  if (process.env.NODE_ENV === "production") return;
  inflight.clear();
}

/**
 * Build a default `TokenRefreshDeps` from the live runtime: real `fetch`,
 * the singleton Prisma client, the app logger, and OAuth credentials from
 * env. Production call sites should use this so the same dependency wiring
 * is shared across every refresh.
 */
export function createDefaultTokenRefreshDeps(): TokenRefreshDeps {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set to refresh tokens"
    );
  }
  return {
    fetch,
    prisma: defaultPrisma as unknown as PrismaLike,
    clientId,
    clientSecret,
  };
}
