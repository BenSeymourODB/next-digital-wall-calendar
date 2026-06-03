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

interface ResolvedKeys {
  active: Buffer;
  previous: Buffer | null;
}

let cachedKeys: ResolvedKeys | null = null;
let cachedKeySource: string | null = null;
let loggedDerivationWarning = false;

/**
 * Decode a base64 or base64url-encoded string into a Buffer, returning null
 * if the input is not valid in either alphabet. We accept both because the
 * docs suggest `openssl rand -base64 32` (standard alphabet) but Node's
 * built-in `randomBytes(32).toString('base64url')` and many secret managers
 * emit base64url (`-`/`_` instead of `+`/`/`), which should not be rejected.
 */
function decodeBase64Key(input: string): Buffer | null {
  const stripped = input.replace(/=+$/, "");
  const normalised = stripped.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+$/.test(normalised)) {
    return null;
  }
  const decoded = Buffer.from(normalised, "base64");
  // Round-trip to catch rare cases where Buffer.from accepts garbage.
  if (decoded.toString("base64").replace(/=+$/, "") !== normalised) {
    return null;
  }
  return decoded;
}

function decodeNamedKey(envVar: string, value: string): Buffer {
  const decoded = decodeBase64Key(value);
  if (!decoded) {
    throw new Error(
      `${envVar} is not valid base64/base64url (generate with \`openssl rand -base64 32\`).`
    );
  }
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `${envVar} must decode to ${KEY_LENGTH} bytes (got ${decoded.length}).`
    );
  }
  return decoded;
}

function resolveKeys(): ResolvedKeys {
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  const previousEnvKey = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  const nodeEnv = process.env.NODE_ENV;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  // Cache key must include the previous-key value so a rotation
  // (active ↔ previous flip in env) invalidates the cached pair.
  const source = envKey
    ? `env:${envKey}|prev:${previousEnvKey ?? ""}`
    : `derived:${nextAuthSecret ?? ""}:${nodeEnv ?? ""}|prev:${previousEnvKey ?? ""}`;
  if (cachedKeys && cachedKeySource === source) {
    return cachedKeys;
  }

  let active: Buffer;
  if (envKey && envKey.length > 0) {
    active = decodeNamedKey("TOKEN_ENCRYPTION_KEY", envKey);
  } else if (nodeEnv !== "production" && nextAuthSecret) {
    // Dev / test convenience: derive a stable 32-byte key from NEXTAUTH_SECRET
    // so developers don't need to generate and distribute a second secret.
    // Warn once per process so shared dev/staging environments don't silently
    // rely on the fallback — rotating NEXTAUTH_SECRET would otherwise
    // unexpectedly invalidate every encrypted token.
    if (!loggedDerivationWarning) {
      console.warn(
        "[token-cipher] TOKEN_ENCRYPTION_KEY not set; deriving key from NEXTAUTH_SECRET. " +
          "Set TOKEN_ENCRYPTION_KEY explicitly for any shared or persistent environment."
      );
      loggedDerivationWarning = true;
    }
    const derived = hkdfSync(
      "sha256",
      Buffer.from(nextAuthSecret, "utf8"),
      Buffer.alloc(0),
      Buffer.from(HKDF_INFO, "utf8"),
      KEY_LENGTH
    );
    active = Buffer.from(derived);
  } else if (nodeEnv === "production") {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required in production. " +
        "Generate with `openssl rand -base64 32` and set it on the server."
    );
  } else {
    throw new Error(
      "Cannot resolve token encryption key: set TOKEN_ENCRYPTION_KEY " +
        "(base64, 32 bytes) or NEXTAUTH_SECRET for the development fallback."
    );
  }

  const previous =
    previousEnvKey && previousEnvKey.length > 0
      ? decodeNamedKey("TOKEN_ENCRYPTION_KEY_PREVIOUS", previousEnvKey)
      : null;

  const keys: ResolvedKeys = { active, previous };
  cachedKeys = keys;
  cachedKeySource = source;
  return keys;
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

  const { active } = resolveKeys();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, active, iv);
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

function decryptWithKey(
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
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

  // Dual-read (#215): try the active key first; on auth-tag mismatch
  // fall back to the previous key (if configured) so a rolling
  // rotation can decrypt envelopes written under either key. Surface
  // the active-key error if both attempts fail — operators triaging
  // `RefreshTokenDecryptFailed` see the failure that matters.
  const { active, previous } = resolveKeys();
  try {
    return decryptWithKey(active, iv, authTag, ciphertext);
  } catch (activeErr) {
    if (!previous) throw activeErr;
    try {
      return decryptWithKey(previous, iv, authTag, ciphertext);
    } catch {
      throw activeErr;
    }
  }
}
