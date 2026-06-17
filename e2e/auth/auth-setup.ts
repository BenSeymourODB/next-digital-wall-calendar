/**
 * E2E test setup for authentication testing
 *
 * This module provides utilities for:
 * - Creating test users and sessions in the database
 * - Setting authentication cookies in Playwright context
 * - Cleaning up test data after tests
 *
 * Uses pg directly instead of Prisma to avoid ESM compatibility issues with Playwright
 */
import type { BrowserContext, Page } from "@playwright/test";
import { randomBytes } from "crypto";
import dotenv from "dotenv";
import path from "path";
import pg from "pg";

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { Pool } = pg;

// Create a connection pool for tests
// Fall back to a default local PostgreSQL connection if no env var is set
const connectionString =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/calendar_db";

const pool = new Pool({ connectionString });

/**
 * Authenticated user data returned from createTestUser
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  sessionToken: string;
  accessToken: string;
}

/**
 * Email used by the shared E2E user created in `e2e/auth.setup.ts` and torn
 * down by `e2e/auth.teardown.ts`. Specs under `e2e/authenticated/**` reuse
 * this user's session via the `storageState` saved at
 * `playwright/.auth/user.json` — issue #278.
 */
export const SHARED_TEST_USER_EMAIL = "e2e-shared@example.com";

/**
 * Absolute path where the shared user's `storageState` JSON is persisted.
 * The setup project writes it; the `authenticated-chromium` project
 * reads it via `use.storageState`. Resolved against `__dirname` rather
 * than `process.cwd()` so both ends agree on the same file regardless
 * of the working directory Playwright was launched from.
 */
export const SHARED_STORAGE_STATE_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "playwright",
  ".auth",
  "user.json"
);

/**
 * Generate a unique test ID to avoid collisions between parallel tests
 */
function generateTestId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Generate a CUID-like ID (simplified version for tests)
 */
function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(8).toString("hex");
  return `c${timestamp}${randomPart}`;
}

/**
 * Create a test user with a valid session in the database
 * This simulates a user who has signed in with Google OAuth
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    name: string;
  }> = {}
): Promise<AuthenticatedUser> {
  const testId = generateTestId();
  const email = overrides.email ?? `test-${testId}@example.com`;
  const name = overrides.name ?? `Test User ${testId}`;
  const userId = generateCuid();

  // Create user
  await pool.query(
    `INSERT INTO "User" (id, email, name, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [userId, email, name, new Date(), new Date()]
  );

  // Generate tokens
  const sessionToken = `test-session-${testId}`;
  const accessToken = `test-access-token-${testId}`;
  const accountId = generateCuid();
  const sessionId = generateCuid();

  // Create Google account (simulates OAuth link)
  await pool.query(
    `INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      accountId,
      userId,
      "oauth",
      "google",
      `google-${testId}`,
      `test-refresh-token-${testId}`,
      accessToken,
      Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      "Bearer",
      "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks",
    ]
  );

  // Create session (NextAuth v5 uses database sessions)
  await pool.query(
    `INSERT INTO "Session" (id, "sessionToken", "userId", expires)
     VALUES ($1, $2, $3, $4)`,
    [
      sessionId,
      sessionToken,
      userId,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    ]
  );

  return {
    userId,
    email,
    sessionToken,
    accessToken,
  };
}

/**
 * Create a test user with an expired session
 */
export async function createTestUserWithExpiredSession(): Promise<AuthenticatedUser> {
  const testId = generateTestId();
  const email = `test-expired-${testId}@example.com`;
  const userId = generateCuid();

  await pool.query(
    `INSERT INTO "User" (id, email, name, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [userId, email, `Expired User ${testId}`, new Date(), new Date()]
  );

  const sessionToken = `expired-session-${testId}`;
  const accessToken = `expired-access-token-${testId}`;
  const accountId = generateCuid();
  const sessionId = generateCuid();

  // Create account with expired token and no refresh token
  await pool.query(
    `INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId", access_token, expires_at, token_type, scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      accountId,
      userId,
      "oauth",
      "google",
      `google-expired-${testId}`,
      accessToken,
      Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      "Bearer",
      "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks",
    ]
  );

  await pool.query(
    `INSERT INTO "Session" (id, "sessionToken", "userId", expires)
     VALUES ($1, $2, $3, $4)`,
    [
      sessionId,
      sessionToken,
      userId,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ]
  );

  return {
    userId,
    email,
    sessionToken,
    accessToken,
  };
}

/**
 * Clean up test user and all associated data
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // Delete in order due to foreign key constraints
    await pool.query(`DELETE FROM "Session" WHERE "userId" = $1`, [userId]);
    await pool.query(`DELETE FROM "Account" WHERE "userId" = $1`, [userId]);
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
  } catch {
    // User may have already been deleted or never existed
  }
}

/**
 * Clean up all test users (for use after test suites)
 */
export async function cleanupAllTestUsers(): Promise<void> {
  try {
    // Delete all users with test email patterns
    await pool.query(
      `DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'test-%')`
    );
    await pool.query(
      `DELETE FROM "Account" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'test-%')`
    );
    await pool.query(`DELETE FROM "User" WHERE email LIKE 'test-%'`);
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Set authentication cookies in Playwright browser context
 * NextAuth v5 uses "authjs.session-token" cookie name
 */
export async function setAuthCookies(
  context: BrowserContext,
  sessionToken: string
): Promise<void> {
  // NextAuth v5 cookie configuration
  // In development, it uses non-secure cookies
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false, // Development mode
      sameSite: "Lax",
    },
  ]);
}

/**
 * Clear authentication cookies from browser context
 */
export async function clearAuthCookies(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Fixture that provides an authenticated page for testing
 */
export async function withAuthenticatedPage<T>(
  context: BrowserContext,
  page: Page,
  fn: (authUser: AuthenticatedUser) => Promise<T>
): Promise<T> {
  const authUser = await createTestUser();

  try {
    await setAuthCookies(context, authUser.sessionToken);
    return await fn(authUser);
  } finally {
    await cleanupTestUser(authUser.userId);
  }
}

/**
 * Disconnect database pool (call in afterAll).
 *
 * Idempotent: the pool is a module-level singleton shared by every spec in a
 * worker, so with Playwright's `workers: 1` (CI) more than one spec file's
 * `afterAll` ends up calling this against the same pool. `pg`'s `pool.end()`
 * throws "Called end on pool more than once" on the second call, so we guard
 * with a flag and only end the pool the first time.
 */
let poolEnded = false;
export async function disconnectDatabase(): Promise<void> {
  if (poolEnded) return;
  poolEnded = true;
  await pool.end();
}

/**
 * Idempotent setup for the shared E2E user. Deletes any stale rows under
 * `SHARED_TEST_USER_EMAIL` first so a crashed prior `auth.setup.ts` run
 * doesn't leave half-state in the DB, then creates a fresh user + session
 * via the same path real OAuth signs-in take. Used by `e2e/auth.setup.ts`
 * — the resulting session token is the one persisted in
 * `playwright/.auth/user.json` for the `authenticated-chromium` project to
 * reuse.
 *
 * Concurrency: serialised via a Postgres advisory lock keyed off
 * `SHARED_TEST_USER_LOCK_KEY` so two simultaneous `pnpm test:e2e`
 * invocations (e.g. CI matrix shards sharing one database) cannot race
 * on the `User.email` UNIQUE constraint between the wipe and the
 * re-create.
 */
const SHARED_TEST_USER_LOCK_KEY = 727801; // arbitrary constant for e2e setup

export async function getOrCreateSharedTestUser(): Promise<AuthenticatedUser> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [
      SHARED_TEST_USER_LOCK_KEY,
    ]);

    // Wipe any stale rows under this email first. We can't reuse them —
    // sessionToken / accessToken values aren't recoverable here once the
    // storageState file is gone, and on a re-run we always want a fresh
    // pair so the prior pair becomes garbage.
    const existing = await client.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [SHARED_TEST_USER_EMAIL]
    );
    for (const row of existing.rows) {
      await client.query(`DELETE FROM "Session" WHERE "userId" = $1`, [row.id]);
      await client.query(`DELETE FROM "Account" WHERE "userId" = $1`, [row.id]);
      await client.query(`DELETE FROM "User" WHERE id = $1`, [row.id]);
    }

    const created = await createTestUser({
      email: SHARED_TEST_USER_EMAIL,
      name: "E2E Shared User",
    });

    return created;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [
        SHARED_TEST_USER_LOCK_KEY,
      ]);
    } finally {
      client.release();
    }
  }
}

/**
 * Teardown counterpart to `getOrCreateSharedTestUser`. Removes the shared
 * user (and cascaded Session/Account rows) so the DB doesn't accumulate
 * orphaned rows between Playwright runs.
 */
export async function cleanupSharedTestUser(): Promise<void> {
  const result = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [
    SHARED_TEST_USER_EMAIL,
  ]);
  for (const row of result.rows) {
    await cleanupTestUser(row.id);
  }
}

/**
 * Get existing user session from database by email
 * Useful for integration tests with real authenticated users
 */
export async function getExistingUserSession(
  email: string
): Promise<AuthenticatedUser | null> {
  try {
    // Find user by email
    const userResult = await pool.query(
      `SELECT id, email FROM "User" WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;

    // Get active session
    const sessionResult = await pool.query(
      `SELECT "sessionToken" FROM "Session" WHERE "userId" = $1 AND expires > NOW() ORDER BY expires DESC LIMIT 1`,
      [userId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const sessionToken = sessionResult.rows[0].sessionToken;

    // Get access token from account
    const accountResult = await pool.query(
      `SELECT access_token FROM "Account" WHERE "userId" = $1 AND provider = 'google' LIMIT 1`,
      [userId]
    );

    const accessToken = accountResult.rows[0]?.access_token ?? "";

    return {
      userId,
      email: userEmail,
      sessionToken,
      accessToken,
    };
  } catch {
    return null;
  }
}

/**
 * Export pool for direct database operations in tests if needed
 */
export { pool };
