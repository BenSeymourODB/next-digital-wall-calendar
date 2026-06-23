# Plan: Simplify `logger.log()` signature (#448)

## Context

`src/lib/logger.ts:304-359` (`Logger.log`) overloads two TypeScript signatures
and runs ~30 lines of runtime argument disambiguation to support three calling
conventions:

```ts
log(message: string, level?: LogLevelInput): void;
log(message: string, properties?: Properties, level?: LogLevelInput): void;
```

Implementation branches at `:315-342` decide whether the second argument is a
`Properties` object or a `LogLevel | "debug" | "info" | "warn"` string.

A repo-wide grep of `logger.log(` across `src/` (39 production call sites
across 13 files) shows **zero call sites pass the level argument** in any form
— every existing call uses either `logger.log(message)` or
`logger.log(message, properties)`. The convenience wrappers
(`logger.debug` / `logger.info` / `logger.warn`) already exist for level-
specific call sites and handle all three severities cleanly.

## Goal

Collapse the overload to a single signature, drop the disambiguation logic,
and document the new contract: use `debug` / `info` / `warn` when severity
is non-default.

## Design

### Public API after this change

```ts
log(message: string, properties?: Properties): void;          // always Info
debug(message: string, properties?: Properties): void;        // Severity 0
info(message: string, properties?: Properties): void;         // Severity 1
warn(message: string, properties?: Properties): void;         // Severity 2
```

`debug` / `info` / `warn` already delegate to `log()` via positional level —
they will switch to a small internal helper (`emitTrace(message, props,
severity)`) so removing the public level argument doesn't break them.

### What gets deleted

- Both `log(...)` overload signatures and the implementation signature's
  `propertiesOrLevel` branch.
- The dead branches in the disambiguation `if`/`else if` chain (~30 lines).

### What gets added

- `src/lib/__tests__/logger.test.ts` — first dedicated test for the logger.
  Covers: default-Info severity for `log()`, properties pass-through,
  defaultProperties merge, severity for each convenience method, server/client
  branch selection (via the `window` typeof check), `withProperties()` child-
  logger inheritance.

### Docs touched

- Module-level JSDoc examples that show `logger.log(msg, LogLevel.X)` or
  `logger.log(msg, props, LogLevel.X)` move to the matching convenience
  method. The "## Simple API - Only 4 methods" header keeps `log()` as #2 but
  rewrites its signature line.
- `docs/application-insights.md` examples updated for the new shape.

### Call sites

No production caller changes — all 39 already use the
`(message)` / `(message, properties)` shape.

## Phases

1. **Tests first (red).** Add `src/lib/__tests__/logger.test.ts` exercising
   the new contract. Tests fail because they assert against the new shape /
   that `log()` rejects level-as-second-arg via TypeScript (compile-time
   only, asserted via `// @ts-expect-error`).
2. **Implement (green).** Replace `log()` overloads with the single signature
   and the `emitTrace()` helper. Rewrite the JSDoc to match. Drop the dead
   disambiguation logic.
3. **Refactor / docs.** Update `docs/application-insights.md` examples; sweep
   logger JSDoc for now-stale `logger.log(msg, LogLevel.X)` snippets.

## Acceptance

- [x] Single `log(message, properties?)` signature; no overloads.
- [x] `logger.debug` / `info` / `warn` remain ergonomic and call into a
      shared internal severity helper.
- [x] `pnpm test` clean; new logger spec covers each method.
- [x] `pnpm check-types` clean across all 39 call sites.
- [x] `pnpm lint:fix && pnpm format:fix` clean.

## Out of scope

- Adding an options-object form `log(msg, { properties, level })` (per the
  issue's literal suggestion) — that would migrate every existing call site
  for no observable improvement over the convenience wrappers. Revisit if a
  future call site genuinely needs both properties and non-Info severity.
- Refactoring the dynamic `import("./appinsights-server" | "./appinsights-
client")` pattern — orthogonal to the complexity finding.
