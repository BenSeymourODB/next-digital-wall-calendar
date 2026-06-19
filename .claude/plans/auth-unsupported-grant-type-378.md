# Auth: reclassify `unsupported_grant_type` as transient (#378)

Follow-up to PR #348 (merged) and parent plan `auth-session-expired-315.md`.

## Problem

`classifyTokenRefreshError` in `src/lib/auth/refresh-error-classifier.ts`
currently treats Google OAuth `unsupported_grant_type` as **terminal**, forcing
re-auth. But `unsupported_grant_type` is always a server-side code/config bug —
we control the `grant_type` we send. Re-auth can never fix it; the next refresh
sends the same wrong `grant_type` and fails identically, trapping the user in a
re-auth loop until an operator deploys a fix.

## Decision

Apply Option 1 from issue #378: classify `unsupported_grant_type` as
**transient**. Rationale recap from the issue:

- The failure is loud in server logs (operator sees the alert) but not
  user-facing — the cached UI keeps working while the operator deploys a fix.
- Misclassifying toward transient just delays a forced re-auth by one callback
  cycle when the diagnosis is wrong; misclassifying toward terminal dumps every
  authenticated user back to a sign-in screen on what is purely an internal bug
  — the exact failure mode #315 fixes.
- Option 2 (a third "operator-terminal" classification) depends on Part D of
  #315 (`/api/health/auth` + admin banner), which has not landed. Revisit then.

## Scope

Two files:

1. `src/lib/auth/refresh-error-classifier.ts` — remove
   `"unsupported_grant_type"` from `TERMINAL_GOOGLE_ERROR_CODES`; rewrite the
   inline comment that justified its inclusion to instead document why it is
   intentionally treated as transient (and link #378).
2. `src/lib/auth/__tests__/refresh-error-classifier.test.ts` — move the
   `unsupported_grant_type` test out of the "terminal" describe block into
   "transient", flip the assertion, and update the comment.

No other callers need changes — `refresh-session-tokens.ts` already routes by
the returned classification.

## TDD

1. Update the test for `unsupported_grant_type` to expect `"transient"`.
2. Run — it fails (current code returns `"terminal"`).
3. Remove `"unsupported_grant_type"` from `TERMINAL_GOOGLE_ERROR_CODES`.
4. Run — test passes; full suite stays green.

## Acceptance

- `pnpm test src/lib/auth/__tests__/refresh-error-classifier.test.ts` passes.
- `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` all
  green.
- PR body closes #378 and notes the deferred Option-2 follow-up tied to #315
  Part D.
