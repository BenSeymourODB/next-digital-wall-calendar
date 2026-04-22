import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for AES-256-GCM token cipher used to encrypt OAuth tokens at rest.
 *
 * Envelope format: v1:<iv_b64url>:<authTag_b64url>:<ciphertext_b64url>
 *  - IV: 12 random bytes per encryption (GCM standard)
 *  - authTag: 16 bytes
 *  - Key: 32 bytes derived from TOKEN_ENCRYPTION_KEY (base64) or, in dev, from
 *    NEXTAUTH_SECRET via HKDF-like derivation.
 */

const TEST_KEY_B64 = randomBytes(32).toString("base64");

async function loadCipher() {
  vi.resetModules();
  return await import("../token-cipher");
}

describe("token-cipher", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY_B64);
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("encryptToken / decryptToken roundtrip", () => {
    it("encrypts then decrypts back to the original plaintext", async () => {
      const { encryptToken, decryptToken } = await loadCipher();
      const plaintext = "ya29.a0AbVbY9abcDEFghIJKLmno-1234567890";
      const encrypted = encryptToken(plaintext);
      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted!.startsWith("v1:")).toBe(true);
      expect(decryptToken(encrypted)).toBe(plaintext);
    });

    it("produces distinct ciphertexts for identical plaintexts (random IV)", async () => {
      const { encryptToken } = await loadCipher();
      const plaintext = "same-token";
      const a = encryptToken(plaintext);
      const b = encryptToken(plaintext);
      expect(a).not.toBe(b);
    });

    it("roundtrips an empty string", async () => {
      const { encryptToken, decryptToken } = await loadCipher();
      const encrypted = encryptToken("");
      expect(encrypted).not.toBeNull();
      expect(encrypted!.startsWith("v1:")).toBe(true);
      expect(decryptToken(encrypted)).toBe("");
    });

    it("roundtrips unicode and long strings", async () => {
      const { encryptToken, decryptToken } = await loadCipher();
      const plaintext = "🔑 refresh=" + "x".repeat(5000) + " ünïcødé";
      const encrypted = encryptToken(plaintext);
      expect(decryptToken(encrypted)).toBe(plaintext);
    });
  });

  describe("null handling", () => {
    it("encryptToken returns null for null input", async () => {
      const { encryptToken } = await loadCipher();
      expect(encryptToken(null)).toBeNull();
    });

    it("decryptToken returns null for null input", async () => {
      const { decryptToken } = await loadCipher();
      expect(decryptToken(null)).toBeNull();
    });

    it("encryptToken returns null for undefined input", async () => {
      const { encryptToken } = await loadCipher();
      expect(encryptToken(undefined)).toBeNull();
    });

    it("decryptToken returns null for undefined input", async () => {
      const { decryptToken } = await loadCipher();
      expect(decryptToken(undefined)).toBeNull();
    });
  });

  describe("backwards compatibility with legacy plaintext", () => {
    it("decryptToken returns legacy plaintext as-is when no version prefix present", async () => {
      const { decryptToken } = await loadCipher();
      const legacy = "ya29.legacy-plaintext-access-token";
      expect(decryptToken(legacy)).toBe(legacy);
    });

    it("isEncrypted returns false for legacy plaintext", async () => {
      const { isEncrypted } = await loadCipher();
      expect(isEncrypted("ya29.plaintext")).toBe(false);
    });

    it("isEncrypted returns true for a v1 envelope", async () => {
      const { encryptToken, isEncrypted } = await loadCipher();
      const encrypted = encryptToken("hello")!;
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("isEncrypted returns false for null / undefined / empty", async () => {
      const { isEncrypted } = await loadCipher();
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted("")).toBe(false);
    });
  });

  describe("tamper detection", () => {
    it("throws when ciphertext segment is tampered", async () => {
      const { encryptToken, decryptToken } = await loadCipher();
      const envelope = encryptToken("sensitive")!;
      const [, iv, tag, ct] = envelope.split(":");
      // flip one base64url character of the ciphertext (safe transform inside alphabet)
      const flipped = ct[0] === "A" ? "B" + ct.slice(1) : "A" + ct.slice(1);
      const tampered = `v1:${iv}:${tag}:${flipped}`;
      expect(() => decryptToken(tampered)).toThrow();
    });

    it("throws when authTag segment is tampered", async () => {
      const { encryptToken, decryptToken } = await loadCipher();
      const envelope = encryptToken("sensitive")!;
      const [, iv, tag, ct] = envelope.split(":");
      const flipped = tag[0] === "A" ? "B" + tag.slice(1) : "A" + tag.slice(1);
      const tampered = `v1:${iv}:${flipped}:${ct}`;
      expect(() => decryptToken(tampered)).toThrow();
    });

    it("throws on a malformed v1 envelope (too few segments)", async () => {
      const { decryptToken } = await loadCipher();
      expect(() => decryptToken("v1:onlyonepart")).toThrow();
    });

    it("throws on an unknown envelope version", async () => {
      const { decryptToken } = await loadCipher();
      expect(() => decryptToken("v99:aaa:bbb:ccc")).toThrow();
    });

    it("throws when decrypting a v1 envelope with a different key", async () => {
      const { encryptToken } = await loadCipher();
      const envelope = encryptToken("secret")!;

      // Reload module with a different key
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
      const { decryptToken: decryptWithOtherKey } = await loadCipher();
      expect(() => decryptWithOtherKey(envelope)).toThrow();
    });
  });

  describe("key derivation", () => {
    it("uses TOKEN_ENCRYPTION_KEY when present", async () => {
      // Already set by beforeEach; roundtrip should succeed
      const { encryptToken, decryptToken } = await loadCipher();
      expect(decryptToken(encryptToken("x"))).toBe("x");
    });

    it("derives a key from NEXTAUTH_SECRET when TOKEN_ENCRYPTION_KEY is absent (non-production)", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      vi.stubEnv(
        "NEXTAUTH_SECRET",
        "dev-only-secret-for-testing-xxxxxxxxxxxxxxxxxx"
      );
      vi.stubEnv("NODE_ENV", "development");

      const { encryptToken, decryptToken } = await loadCipher();
      const envelope = encryptToken("derived-key-test");
      expect(envelope).not.toBeNull();
      expect(decryptToken(envelope)).toBe("derived-key-test");
    });

    it("throws in production when TOKEN_ENCRYPTION_KEY is missing", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      vi.stubEnv("NEXTAUTH_SECRET", "some-production-secret");
      vi.stubEnv("NODE_ENV", "production");

      const { encryptToken } = await loadCipher();
      expect(() => encryptToken("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
    });

    it("throws when TOKEN_ENCRYPTION_KEY decodes to the wrong length", async () => {
      // 16 bytes is not 32 — should be rejected
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(16).toString("base64"));
      const { encryptToken } = await loadCipher();
      expect(() => encryptToken("x")).toThrow(/32 bytes/);
    });

    it("throws when TOKEN_ENCRYPTION_KEY is not valid base64", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "!!!not-base64!!!");
      const { encryptToken } = await loadCipher();
      expect(() => encryptToken("x")).toThrow();
    });
  });
});
