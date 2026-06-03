import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the rotate-token-encryption-key CLI helper (#215).
 *
 * Covers the pure `reencryptAccountTokens` step: given an Account row and a
 * cipher API, return the partial update payload that re-encrypts every
 * encrypted token field under the active key. Null / plaintext / no-op rows
 * are handled without touching the database.
 *
 * The Prisma I/O wiring in `main()` is deliberately not unit-tested — its
 * contract is exercised by the runbook integration step in
 * `docs/auth-token-encryption.md` (deferred to a follow-up issue for a full
 * seeded-DB harness).
 */

const OLD_KEY = randomBytes(32).toString("base64");
const NEW_KEY = randomBytes(32).toString("base64");

async function loadCipher() {
  vi.resetModules();
  return await import("../../src/lib/crypto/token-cipher");
}

async function loadHelper() {
  vi.resetModules();
  return await import("../rotate-token-encryption-key.mjs");
}

describe("reencryptAccountTokens", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when every token column is null", async () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", OLD_KEY);
    const cipher = await loadCipher();
    const { reencryptAccountTokens } = await loadHelper();

    const update = reencryptAccountTokens(
      {
        id: "acct-null",
        access_token: null,
        refresh_token: null,
        id_token: null,
      },
      cipher
    );

    expect(update).toBeNull();
  });

  it("re-encrypts an envelope written under the previous key under the active key", async () => {
    // Step 1: write a row using the OLD key as ACTIVE (no previous).
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", OLD_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", "");
    const writer = await loadCipher();
    const oldAccess = writer.encryptToken("access-plaintext")!;
    const oldRefresh = writer.encryptToken("refresh-plaintext")!;
    const oldId = writer.encryptToken("id-plaintext")!;

    // Step 2: rotation window — NEW key is ACTIVE, OLD is PREVIOUS.
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", OLD_KEY);
    const cipher = await loadCipher();
    const { reencryptAccountTokens } = await loadHelper();

    const update = reencryptAccountTokens(
      {
        id: "acct-rotated",
        access_token: oldAccess,
        refresh_token: oldRefresh,
        id_token: oldId,
      },
      cipher
    );

    expect(update).not.toBeNull();
    expect(update?.access_token).not.toBe(oldAccess);
    expect(update?.refresh_token).not.toBe(oldRefresh);
    expect(update?.id_token).not.toBe(oldId);
    expect(update?.access_token?.startsWith("v1:")).toBe(true);

    // Step 3: drop the PREVIOUS key — the re-encrypted envelopes must
    // still decrypt because they're under the NEW (active) key.
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", "");
    const postRotation = await loadCipher();
    expect(postRotation.decryptToken(update!.access_token!)).toBe(
      "access-plaintext"
    );
    expect(postRotation.decryptToken(update!.refresh_token!)).toBe(
      "refresh-plaintext"
    );
    expect(postRotation.decryptToken(update!.id_token!)).toBe("id-plaintext");
  });

  it("preserves legacy plaintext token columns unchanged", async () => {
    // Plaintext entries are not re-encrypted by the CLI — the next
    // session refresh writes them as v1 envelopes naturally. Touching
    // them here would corrupt rows whose tokens were never encrypted.
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", OLD_KEY);
    const cipher = await loadCipher();
    const { reencryptAccountTokens } = await loadHelper();

    const update = reencryptAccountTokens(
      {
        id: "acct-legacy",
        access_token: "ya29.legacy-plaintext-access",
        refresh_token: null,
        id_token: null,
      },
      cipher
    );

    expect(update).toBeNull();
  });

  it("re-encrypts only the encrypted columns and leaves legacy plaintext alone", async () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", OLD_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", "");
    const writer = await loadCipher();
    const oldEnvelope = writer.encryptToken("access-plaintext")!;

    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", OLD_KEY);
    const cipher = await loadCipher();
    const { reencryptAccountTokens } = await loadHelper();

    const update = reencryptAccountTokens(
      {
        id: "acct-mixed",
        access_token: oldEnvelope,
        refresh_token: "legacy-refresh-plaintext",
        id_token: null,
      },
      cipher
    );

    // Only access_token is in the update payload.
    expect(update).not.toBeNull();
    expect(update?.access_token).toBeDefined();
    expect(update?.refresh_token).toBeUndefined();
    expect(update?.id_token).toBeUndefined();
  });

  it("is idempotent on a row already encrypted under the active key", async () => {
    // The CLI is safe to re-run after a partial failure: a row whose
    // tokens are already under the active key still gets re-written,
    // but the new envelope decrypts to the same plaintext (new IV, same
    // key — the on-disk shape changes but the secret value is
    // preserved).
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", OLD_KEY);
    const cipher = await loadCipher();
    const { reencryptAccountTokens } = await loadHelper();

    const original = cipher.encryptToken("already-rotated")!;
    const update = reencryptAccountTokens(
      {
        id: "acct-idempotent",
        access_token: original,
        refresh_token: null,
        id_token: null,
      },
      cipher
    );

    expect(update).not.toBeNull();
    expect(update?.access_token).not.toBe(original); // new IV
    expect(cipher.decryptToken(update!.access_token!)).toBe("already-rotated");
  });

  it("rejects a tampered envelope by throwing — caller surfaces the failure", async () => {
    // Tampered ciphertext fails GCM auth on both keys; the CLI must
    // bubble the error so the row sticks out in the failure summary
    // instead of silently disappearing.
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", NEW_KEY);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", OLD_KEY);
    const cipher = await loadCipher();
    const { reencryptAccountTokens } = await loadHelper();

    expect(() =>
      reencryptAccountTokens(
        {
          id: "acct-tampered",
          access_token: "v1:AAAA:BBBB:CCCC",
          refresh_token: null,
          id_token: null,
        },
        cipher
      )
    ).toThrow();
  });
});
