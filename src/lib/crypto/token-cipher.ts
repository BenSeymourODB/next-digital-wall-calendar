import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM cipher for OAuth tokens at rest.
 *
 * Envelope format: `v1:<iv>:<authTag>:<ciphertext>` where every segment is
 * base64url-encoded. IV is 12 bytes (GCM standard); authTag is 16 bytes; the
 * key is 32 bytes sourced from {@link resolveKey}.
 *
 * Plaintext strings without the `v1:` prefix are treated as legacy (pre-
 * encryption) values on decrypt and passed through unchanged. Callers can use
 * {@link isEncrypted} to decide whether to re-encrypt on the next write.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CURRENT_VERSION = "v1";
const HKDF_INFO = "token-cipher/v1";

let cachedKey: Buffer | null = null;
let cachedKeySource: string | null = null;

function resolveKey(): Buffer {
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  const nodeEnv = process.env.NODE_ENV;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  const source = envKey
    ? `env:${envKey}`
    : `derived:${nextAuthSecret ?? ""}:${nodeEnv ?? ""}`;
  if (cachedKey && cachedKeySource === source) {
    return cachedKey;
  }

  let key: Buffer;
  if (envKey && envKey.length > 0) {
    const decoded = Buffer.from(envKey, "base64");
    // Buffer.from silently tolerates invalid base64 by producing a shorter
    // buffer, so re-encode and compare to detect malformed input.
    if (
      decoded.toString("base64").replace(/=+$/, "") !==
      envKey.replace(/=+$/, "")
    ) {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY is not valid base64 (generate with `openssl rand -base64 32`)."
      );
    }
    if (decoded.length !== KEY_LENGTH) {
      throw new Error(
        `TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${decoded.length}).`
      );
    }
    key = decoded;
  } else if (nodeEnv !== "production" && nextAuthSecret) {
    // Dev / test convenience: derive a stable 32-byte key from NEXTAUTH_SECRET
    // so developers don't need to generate and distribute a second secret.
    const derived = hkdfSync(
      "sha256",
      Buffer.from(nextAuthSecret, "utf8"),
      Buffer.alloc(0),
      Buffer.from(HKDF_INFO, "utf8"),
      KEY_LENGTH
    );
    key = Buffer.from(derived);
  } else {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required in production. " +
        "Generate with `openssl rand -base64 32` and set it on the server."
    );
  }

  cachedKey = key;
  cachedKeySource = source;
  return key;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64Url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Returns true if {@link value} looks like a v1 (or future versioned) envelope
 * produced by this module. Legacy plaintext and empty / nullish values return
 * false.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^v\d+:/.test(value);
}

/**
 * Encrypt a token with AES-256-GCM and return a v1 envelope string.
 *
 * Nullish inputs return null. Empty strings are encrypted (and roundtrip to
 * empty strings) so callers can distinguish "no value" from "empty value".
 */
export function encryptToken(
  plaintext: string | null | undefined
): string | null {
  if (plaintext == null) return null;

  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    CURRENT_VERSION,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(ciphertext),
  ].join(":");
}

/**
 * Decrypt a v1 envelope and return the plaintext.
 *
 * - Nullish inputs return null.
 * - Legacy plaintext (no version prefix) is returned unchanged, so the auth
 *   helpers can keep reading tokens written before encryption was enabled.
 *   Callers should re-encrypt on the next write using {@link isEncrypted}.
 * - Tampered ciphertext, malformed envelopes, and unknown versions throw.
 */
export function decryptToken(
  envelope: string | null | undefined
): string | null {
  if (envelope == null) return null;
  if (!isEncrypted(envelope)) {
    // Legacy plaintext — pass through. Next write should re-encrypt.
    return envelope;
  }

  const parts = envelope.split(":");
  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported token envelope version: ${version}`);
  }
  if (parts.length !== 4 || !ivB64 || !tagB64 || ctB64 == null) {
    throw new Error("Malformed token envelope: expected v1:<iv>:<tag>:<ct>");
  }

  const iv = fromBase64Url(ivB64);
  const authTag = fromBase64Url(tagB64);
  const ciphertext = fromBase64Url(ctB64);

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Malformed token envelope: IV must be ${IV_LENGTH} bytes`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Malformed token envelope: authTag must be ${AUTH_TAG_LENGTH} bytes`
    );
  }

  const key = resolveKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
