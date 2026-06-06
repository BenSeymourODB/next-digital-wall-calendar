# Plan — feat(auth): automate OAuth token-key rotation (#215)

## Goal

PR #158 ("encrypt OAuth tokens at rest") introduced a v1 envelope but
explicitly deferred operational tooling for key rotation. The
`docs/auth-token-encryption.md` runbook today tells operators that a
rotation forces every user to re-login — fine for a single-family
deployment but not a defensible posture for the broader self-host
audience.

This issue adds:

1. **Dual-read decryption** so an active key and a previous key are
   both accepted for reads during a rotation window. Encryption always
   uses the active key.
2. **A rotation CLI** (`scripts/rotate-token-encryption-key.mjs`) that
   walks the `Account` table in batches, decrypts each token with the
   active-or-previous key, and re-encrypts it under the active key.
3. **Documentation** in `docs/auth-token-encryption.md` covering the
   rolling-rotation runbook.

## Out of scope (deferred)

- A full live integration test against a seeded Postgres instance. The
  CLI's rotation logic will be unit-tested by extracting the pure
  re-encrypt step into a testable function and feeding it fake rows;
  the Prisma I/O wiring stays thin.
- Multiple previous keys (a single `TOKEN_ENCRYPTION_KEY_PREVIOUS` is
  enough for the one-at-a-time rotation pattern; expanding to a list
  is trivial later if needed).
- A new envelope version. The issue body suggested "bumping the
  version byte" on rotation, but a pure key rotation under the same
  AES-256-GCM algorithm does not need it — the version byte stays
  reserved for algorithm/scheme changes, which keeps the rotation
  scriptidempotent (running it twice produces identical envelope
  shapes).

## Design

### Dual-read in `src/lib/crypto/token-cipher.ts`

Today `resolveKey()` returns a single `Buffer`. After this change it
becomes `resolveKeys()` and returns:

```ts
type ResolvedKeys = {
  active: Buffer;
  previous: Buffer | null;
};
```

`encryptToken` reads `active` only. `decryptToken`:

1. Attempts AES-GCM decrypt with `active`.
2. On any decryption error (auth-tag mismatch is the expected one
   immediately after a rotation), and only if `previous` is non-null,
   re-tries with `previous`.
3. If both fail, throws the original error — operators see
   `RefreshTokenDecryptFailed` exactly as before for terminal cases.

`TOKEN_ENCRYPTION_KEY_PREVIOUS` is a new env var with identical
parsing rules to `TOKEN_ENCRYPTION_KEY` (base64 or base64url, 32 bytes,
fatal if malformed). If unset, behaviour is unchanged — single-key
read.

The module's cache key already incorporates the source string; extend
it to include the previous key so a `vi.stubEnv` flip across tests is
reflected.

### CLI in `scripts/rotate-token-encryption-key.mjs`

Mirrors `scripts/check-migration-naming.mjs` style: ESM, JSDoc types,
a pure exported helper plus a thin `main()` that wires CLI flags and
Prisma.

```
Usage:
  node scripts/rotate-token-encryption-key.mjs [--dry-run] [--batch-size=N]

Required env:
  TOKEN_ENCRYPTION_KEY            New (active) key (base64, 32 bytes)
  TOKEN_ENCRYPTION_KEY_PREVIOUS   Previous key (base64, 32 bytes)
  DATABASE_URL                    Standard Prisma URL
```

Behaviour:

- Refuses to run when either key env is missing — that's exactly the
  scenario the dual-read protects against, but the CLI cannot rotate
  without both.
- Refuses to run when the two keys decode to the same 32 bytes —
  prevents an accidental no-op that would still bill a full table
  scan.
- Iterates `Account` rows that have at least one non-null token
  column, in `--batch-size` chunks ordered by `id`. For each row,
  decrypts each non-null token (legacy plaintext passes through
  unchanged), then re-encrypts under the active key. Updates the row
  inside a per-batch `prisma.$transaction` so a failure on any row in
  the batch rolls the batch back.
- In `--dry-run`, every step except the final `update()` runs;
  decryption failures still surface so an operator can spot tampered
  rows before the real run.
- Prints a single-line progress log every batch and a final summary.
  Exits non-zero on any failure.

Extracted pure helper:

```ts
/**
 * Pure re-encrypt step for one Account row. Returns the partial
 * update payload (only changed columns) or null if nothing needs
 * writing.
 */
function reencryptAccountRow(row, { encryptToken, decryptToken }) { ... }
```

Tests for this helper cover:

- All three fields present, all encrypted → returns three new
  envelopes that decrypt back to the original plaintext.
- A null field stays null.
- A legacy plaintext field (no `v1:` prefix) stays as-is (not
  re-encrypted from plaintext — the next session refresh handles
  that).
- A row with no encrypted fields at all returns null (no update
  needed).

### Documentation

`docs/auth-token-encryption.md` — replace the "Rotating the key" stub
with:

1. The rolling-rotation runbook (deploy new + old keys, run the CLI,
   drop the old key, redeploy).
2. The dual-read contract (which envelope formats decrypt with which
   key).
3. A reminder that the previous-key env var must be unset after the
   rotation completes — otherwise an attacker who later compromises
   the now-retired key can still decrypt fresh tokens.

## Test strategy (TDD)

1. **Cipher (red)**: add tests in
   `src/lib/crypto/__tests__/token-cipher.test.ts` for:
   - decrypt with previous key after active rotates
   - decrypt rejects when neither active nor previous matches
   - previous key absent → single-key behaviour preserved (regression
     guard)
   - encrypt always uses active key (write doesn't fall back)
     Make them pass by introducing `TOKEN_ENCRYPTION_KEY_PREVIOUS`
     plumbing.
2. **CLI helper (red)**: new
   `scripts/__tests__/rotate-token-encryption-key.test.ts` with
   fixture rows.
3. **Green**: implement cipher changes + CLI helper.
4. **Refactor + docs**: tidy CLI `main()`, update runbook.
5. **Validate**: `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.

## Risk register

- **Cache stickiness**: forgetting to invalidate the module-level
  cache on previous-key change would corrupt subsequent tests. The
  existing `loadCipher()` helper already calls `vi.resetModules`, so
  new tests inherit that. Production servers reboot on env change so
  the in-process cache is moot there.
- **Atomicity vs throughput**: per-row transactions are slow but
  safe; per-batch transactions are fast but a single-row failure
  rolls back N rows. The CLI picks per-batch. The decryption step is
  side-effect-free, so the failure mode is "we re-process a batch on
  the next CLI invocation", which is idempotent.
- **Empty-string plaintext**: the cipher round-trips `""` correctly
  (test exists), so the re-encrypt step preserves the distinction
  between `null` and `""`.

## File list

- `src/lib/crypto/token-cipher.ts` — extend resolution + decrypt
- `src/lib/crypto/__tests__/token-cipher.test.ts` — add dual-read tests
- `scripts/rotate-token-encryption-key.mjs` — new
- `scripts/__tests__/rotate-token-encryption-key.test.ts` — new
- `docs/auth-token-encryption.md` — runbook update
