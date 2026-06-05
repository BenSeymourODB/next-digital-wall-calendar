# Validate `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` at boot — Issue #379

## Goal

Surface a missing / empty `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` as an
immediate boot failure on `pnpm start` instead of as a per-session
`invalid_client` → terminal-classifier → forced re-auth loop. This is the
parallel to PR #348's `validateEncryptionKey()` for the OAuth client
credentials.

## Background

PR #348 introduced `validateEncryptionKey()` in `src/lib/crypto/token-cipher.ts`
and called it from `src/lib/auth/auth.ts` at module init behind a
`process.env.NEXT_PHASE !== "phase-production-build"` guard (so `next build`
page-data collection doesn't trip on missing runtime env). Production runtime
(`NEXT_PHASE` unset or `phase-production-server`) still validates eagerly.

`auth.ts` reads `GOOGLE_CLIENT_ID!` / `GOOGLE_CLIENT_SECRET!` via non-null
assertions when wiring the NextAuth `Google` provider. If either is missing,
the provider silently registers with `undefined`, and the first OAuth call
gets back `invalid_client` from Google. `refreshGoogleAccessToken` then routes
that through `refresh-error-classifier`, which (correctly) treats Google's
`invalid_client` as terminal and force-logs the user out. This is the same
misconfig-as-user-error failure class issue #315 set out to eliminate.

## Scope

Add a boot assertion that throws if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`
is unset (`undefined`) or empty (`""`) when the module is loaded outside of
the `phase-production-build` guard. The error message must name the missing
variable so an operator can fix the env in seconds.

Out of scope:

- Adding new env vars (no schema changes).
- Touching the refresh-error classifier — `invalid_client` correctly remains
  terminal; the proposal is to make sure we never get there in the first
  place.
- The `NEXT_PUBLIC_GOOGLE_CLIENT_ID` legacy browser-side variable (still read
  by `src/lib/google-calendar.ts`); only the server-side credentials are in
  scope for #379.

## Design

### New file: `src/lib/auth/validate-google-oauth-env.ts`

Mirror the surface of `validateEncryptionKey()` — a side-effect-free function
that throws synchronously with a descriptive error. Co-locate with the other
auth helpers (`refresh-error-classifier.ts`, `sign-in-guard.ts`, etc.) since
that is where future env-validation helpers will naturally land.

```ts
export function validateGoogleOAuthEnv(): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Missing required Google OAuth env var(s): ${missing.join(", ")}. ` +
        "Set these from your Google Cloud Console OAuth client " +
        "(https://console.cloud.google.com/apis/credentials). " +
        "Without them, NextAuth registers the provider with `undefined` " +
        "credentials and Google returns `invalid_client` on first refresh, " +
        "which the refresh-error classifier (correctly) treats as terminal " +
        "and force-logs the user out — see issues #315 / #379."
    );
  }
}
```

A single combined error mentions every missing var so operators don't have to
restart twice to learn both are unset. Empty-string is treated as missing
because `process.env.X = ""` is a common shell footgun (`export X=` with no
value).

### Update: `src/lib/auth/auth.ts`

Call `validateGoogleOAuthEnv()` immediately after `validateEncryptionKey()`,
under the same `NEXT_PHASE` guard:

```ts
if (process.env.NEXT_PHASE !== "phase-production-build") {
  validateEncryptionKey();
  validateGoogleOAuthEnv();
}
```

Keeping both calls under one guard means the build-time skip behaviour
remains identical and a single boot check covers both misconfig classes.

The comment block above the guard already references #315 and the
misconfig-as-mid-session-error class; I will extend it briefly to note that
the same guard now also covers the OAuth client credentials, citing #379.

## Tests — TDD

New file: `src/lib/auth/__tests__/validate-google-oauth-env.test.ts`.

Use `vi.stubEnv` / `vi.unstubAllEnvs` (same pattern as
`token-cipher.test.ts`) so each case is hermetic.

1. **Both present** → returns silently (no throw).
2. **`GOOGLE_CLIENT_ID` unset** → throws, error message mentions
   `GOOGLE_CLIENT_ID`.
3. **`GOOGLE_CLIENT_SECRET` unset** → throws, error message mentions
   `GOOGLE_CLIENT_SECRET`.
4. **Both unset** → throws once, error message mentions both var names.
5. **`GOOGLE_CLIENT_ID` empty string** → throws (empty string treated as
   missing).
6. **`GOOGLE_CLIENT_SECRET` empty string** → throws.
7. **Error message references issue trail** (#315 / #379) so the next
   triager doesn't repeat the analysis.

I will NOT add a side-effect test that imports `auth.ts` at module load —
NextAuth's module init pulls in the Prisma client and database connection,
which is heavy and would couple this unit test to unrelated subsystems. The
classifier's correctness against `invalid_client` is already covered by
`refresh-error-classifier.test.ts`; what's new here is only the boot
assertion, which we can test as a pure function.

## Acceptance

- `pnpm test` passes (new + existing).
- `pnpm lint:fix && pnpm format:fix && pnpm check-types` clean.
- `pnpm build` still succeeds (proves the `NEXT_PHASE` guard works during
  page-data collection, exactly like `validateEncryptionKey`).
- Manual sanity (not committed): unsetting `GOOGLE_CLIENT_ID` in `.env.local`
  and running `pnpm dev` should now produce the descriptive boot error
  instead of silently proceeding to a runtime `invalid_client`.

## Risks

- **None on the happy path.** Anyone running with a populated `.env` is
  unaffected.
- **Local dev with `.env.local` not configured** — devs who currently muddle
  through with empty Google creds (rare; auth would be broken anyway) will
  now see a hard boot error. That is the intended UX.
- **CI** — CI environments must provide both vars for any test that boots
  NextAuth. A quick grep shows existing tests stub these (or operate on
  isolated unit modules), so no CI fixture changes are expected.

## Phases

Single-phase change — tests + ~25 lines of production code.
