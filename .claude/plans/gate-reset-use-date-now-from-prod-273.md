# Gate `__resetUseDateNowForTests` from production bundle (#273)

## Why

`__resetUseDateNowForTests` is exported alongside the production hook in
`src/lib/hooks/use-date-now.ts` (lines 113-120). It captures the
module-level singletons (`timeoutId`, `subscribers`, `refreshDates`) and
ships into the production bundle even though no production caller uses
it. PR #225 review explicitly flagged this as future cleanup.

## Approach

Pick option 1 from the issue ("gate behind `NODE_ENV`"). It is the
smaller change and avoids a sibling module that would have to import
private singletons across file boundaries.

The pattern below is the canonical Next.js dead-code-elimination shape:
the bundler replaces `process.env.NODE_ENV` with the literal
`"production"` at build time, so the conditional is statically resolved
and the test-only branch's closure body becomes unreachable code that
DCE drops.

```ts
export const __resetUseDateNowForTests: () => void =
  process.env.NODE_ENV !== "production"
    ? (): void => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        subscribers.clear();
        refreshDates();
      }
    : (): void => {};
```

The export symbol still exists (so the test file's named import
resolves) but in a production build it is a no-op stub — the timer and
subscriber-clearing implementation is gone.

In Vitest (`NODE_ENV=test`) the conditional resolves to the real impl,
so existing tests keep passing without modification.

## Files

- `src/lib/hooks/use-date-now.ts` — replace the unconditional
  `export function __resetUseDateNowForTests` with the gated `const`
  declaration above. Update the JSDoc to mention the prod no-op.

No changes needed in `src/lib/hooks/__tests__/use-date-now.test.ts` —
the existing import continues to work and the impl runs in test mode.

## Verification (acceptance criteria)

- [x] All existing tests still pass (`pnpm test`)
- [x] `pnpm build` succeeds
- [x] `grep -r "subscribers\.clear" .next/` finds nothing under any
      `use-date-now` chunk — confirms the body was DCE'd
- [x] Code-quality gate passes
      (`pnpm lint:fix && pnpm format:fix && pnpm check-types`)

## Out of scope

- Refactoring the singleton into a class (would be a bigger change and
  is not what the reviewer asked for)
- Side-module split (`use-date-now.test-utils.ts`) — the issue lists it
  as alternative #2; we picked #1
