# OAuth token encryption at rest

Google OAuth `access_token`, `refresh_token`, and `id_token` values are
encrypted before they are written to the `Account` table in PostgreSQL. This
document covers how the encryption works, how to operate it, and how to
respond when things go wrong.

## What is encrypted

- `Account.access_token`
- `Account.refresh_token`
- `Account.id_token`

Other `Account` columns (provider, scope, expires_at, etc.) are **not**
encrypted — they are used for queries and routing, and leaking them without
the token values does not compromise authentication.

## How it works

Tokens are wrapped in a versioned envelope:

```
v1:<iv>:<authTag>:<ciphertext>
```

- **Algorithm**: AES-256-GCM (authenticated encryption — any tampering fails
  decryption).
- **IV**: 12 random bytes per encryption (GCM standard).
- **Auth tag**: 16 bytes.
- **Encoding**: every segment is base64url.
- **Key**: 32 bytes sourced from `TOKEN_ENCRYPTION_KEY` (see below).

The envelope format is versioned so a future `v2:` can introduce a new
algorithm or key format without breaking reads.

## Writing flow

1. **Initial OAuth link** — `@auth/prisma-adapter` creates the row with
   plaintext tokens, then the `events.linkAccount` hook in
   `src/lib/auth/auth.ts` (delegating to
   `src/lib/auth/link-account.ts`) runs and `UPDATE`s the row with `v1:...`
   envelopes.
   - **Happy-path plaintext window**: one Prisma round trip (tens of ms).
   - **Worst-case plaintext window**: if `encryptLinkedAccount` itself
     fails (DB hiccup, transient connection error), the failure is logged
     with context `LinkAccountEncryptionFailed` and sign-in is **not**
     blocked. Plaintext remains in the row until the next successful
     session-callback refresh re-encrypts it — up to the access token's
     lifetime (~1h for Google's default `expires_in`). Callers reading via
     `getAccessToken` / `getGoogleAccount` continue to work throughout
     because they accept legacy plaintext transparently.
2. **Token refresh** — when the session callback detects an expired access
   token, the stored refresh token is decrypted, Google's token endpoint is
   called, and the new access + refresh tokens are encrypted before
   `prisma.account.update`.
   - Decryption failures here (tampered envelope, GCM auth-tag mismatch,
     unknown envelope version after a key rotation) log with context
     `RefreshTokenDecryptFailed` before the outer catch marks the session
     with `RefreshTokenError`. Operators can tell a cipher-side problem
     apart from a Google-side refresh failure.

## Reading flow

`src/lib/auth/helpers.ts` owns the read path:

- `getAccessToken()` decrypts `access_token` before returning it.
- `getGoogleAccount()` returns a clone of the row with every token field
  decrypted.

Callers (API routes, etc.) always see plaintext and never need to know the
tokens are encrypted on disk.

## Backwards compatibility

`decryptToken` returns legacy plaintext (no `v1:` prefix) unchanged. That
means the first deploy of this feature does **not** need a data migration:

- Existing plaintext tokens keep working for reads.
- The first successful token refresh for each user re-writes the row with
  `v1:` envelopes.
- After every account has refreshed at least once (typically within the
  `expires_at` lifetime — 1 hour for Google — of any active user), all rows
  are encrypted.

Use `isEncrypted(value)` from `src/lib/crypto/token-cipher.ts` if you need to
check whether a value is already enveloped (e.g. in a background migration).

## `TOKEN_ENCRYPTION_KEY`

### Generating

```bash
openssl rand -base64 32
```

Must decode to **exactly 32 bytes**. Invalid base64 or the wrong byte length
is a fatal error at first use.

### Required in production

If `NODE_ENV=production` and `TOKEN_ENCRYPTION_KEY` is missing or empty,
`encryptToken` / `decryptToken` throw. This is intentional — starting
production with no encryption key is never correct.

### Development fallback

In non-production environments, if `TOKEN_ENCRYPTION_KEY` is absent the
cipher derives a 32-byte key from `NEXTAUTH_SECRET` via HKDF-SHA256 with info
`token-cipher/v1`. This keeps local setup to a single secret.

The fallback is deterministic: the same `NEXTAUTH_SECRET` always produces the
same derived key. If you need stable encrypted values across a dev team (or
between dev and staging) you should set `TOKEN_ENCRYPTION_KEY` explicitly.

## Operations

### Rotating the key

The cipher supports a **rolling rotation window** so a key change does
not force every user to re-login. During the window the active key
(used for writes) and the previous key (read-only fallback) are both
configured; a CLI walks the `Account` table and re-encrypts every
stored envelope under the active key; once the table is clean the
previous key is dropped.

#### Env-var contract

- `TOKEN_ENCRYPTION_KEY` — always the **active** key. All new writes
  go through this one.
- `TOKEN_ENCRYPTION_KEY_PREVIOUS` — optional. When set,
  `decryptToken` will fall back to it if the active key fails to
  decrypt an envelope (typical immediately after a rotation: the row
  was written under the old key, but the new key is now active).

Both follow the same parsing rules (base64 or base64url, 32 bytes,
fatal on malformed input). Leave `TOKEN_ENCRYPTION_KEY_PREVIOUS` unset
in steady state — keeping a retired key plumbed in means anyone who
later compromises the retired key can still read your current
envelopes.

#### Runbook

1. **Generate the new key.**

   ```bash
   openssl rand -base64 32
   ```

2. **Deploy both keys.** Set `TOKEN_ENCRYPTION_KEY` to the new value
   and `TOKEN_ENCRYPTION_KEY_PREVIOUS` to the existing one. Redeploy.
   The app continues to serve traffic — writes go out under the new
   key; reads of existing rows transparently fall back to the
   previous one. There is no forced re-login.

3. **Run the rotation CLI** from a host with `DATABASE_URL` and both
   key env vars set:

   ```bash
   pnpm tsx scripts/rotate-token-encryption-key.mjs --dry-run
   pnpm tsx scripts/rotate-token-encryption-key.mjs
   ```

   The CLI walks `Account` in batches (default 100) and re-encrypts
   every encrypted token column. Legacy plaintext rows are skipped
   (the next session refresh writes them as v1 envelopes naturally).
   On any per-row decryption failure the row is logged with its
   `Account.id` and counted in the final summary; the CLI exits
   non-zero so an automation can detect partial completion.

   Re-running the CLI is safe — it is idempotent (rows already
   encrypted under the active key get fresh IVs but the same
   plaintext).

4. **Verify and retire the previous key.** Confirm the CLI summary
   shows `failed=0`. Unset `TOKEN_ENCRYPTION_KEY_PREVIOUS` and
   redeploy. The cipher is back to single-key mode.

#### What if a row fails to decrypt?

A row whose tokens decrypt under neither key is either tampered or
was written under a third key that was never in
`TOKEN_ENCRYPTION_KEY_PREVIOUS`. The CLI surfaces the failure in its
summary and continues with the rest of the table. The affected user
will be prompted to sign in again on their next token refresh — the
same `RefreshTokenError` path that has always handled this case.

### Suspected key compromise

1. Generate a new key (`openssl rand -base64 32`).
2. Set `TOKEN_ENCRYPTION_KEY` to the new value and redeploy.
3. Users will be forced to sign in again on their next token refresh.
4. Revoke the suspected-compromised tokens in the Google Cloud Console if the
   compromise is credible — encryption protects against database exfiltration
   but not against tokens that may have been leaked elsewhere.

### Database exfiltration

With `TOKEN_ENCRYPTION_KEY` kept outside the database (e.g. in environment
variables, a secret manager, Coolify secrets), a dump of the `Account` table
alone is not sufficient to impersonate users. An attacker would also need
the key, which lives on the application server.

## Code references

- `src/lib/crypto/token-cipher.ts` — cipher implementation (dual-read)
- `src/lib/crypto/__tests__/token-cipher.test.ts` — cipher tests
- `scripts/rotate-token-encryption-key.mjs` — rotation CLI
- `scripts/__tests__/rotate-token-encryption-key.test.ts` — CLI helper tests
- `src/lib/auth/auth.ts` — `events.linkAccount` + session refresh
- `src/lib/auth/helpers.ts` — `getAccessToken` / `getGoogleAccount`
