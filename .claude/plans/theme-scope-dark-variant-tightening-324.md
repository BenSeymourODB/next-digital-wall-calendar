# Theme scope: dark variant tightening (issue #324)

## Problem

`ThemeScope` (`src/components/theme/theme-scope.tsx`) re-declares all
shadcn/ui semantic token CSS variables inside a
`[data-theme-scope="light" | "dark"]` subtree. Token-driven utilities
(`bg-background`, `text-foreground`, SVG fills via `var(--card)`, …)
therefore flip correctly inside the scope regardless of the outer theme.

What `ThemeScope` cannot reverse is Tailwind's `dark:` variant. As
currently declared in `src/app/globals.css`:

```css
@custom-variant dark (&:where(.dark, .dark *, .wall-projector, .wall-projector *));
```

…any element under `.dark` or `.wall-projector` matches `dark:`, even if
it sits inside a `[data-theme-scope="light"]` island. 19 components in
`src/components/ui/` use `dark:` overrides (e.g. Button's `outline`
variant: `dark:bg-input/30 dark:border-input dark:hover:bg-input/50`),
so a future ThemeScope consumer wrapping a Button under Wall-Projector
would see the dark override stick.

## Approach — tighten the `dark` custom variant

The issue body lists two options. We take the **Alternative**:

- A. Per-component audit: replace `dark:` with semantic tokens in
  `src/components/ui/**`. Rejected: `pnpm bump-ui` overwrites that
  directory, so the work would not survive an upgrade. CLAUDE.md
  explicitly carves out `src/components/ui/**` from lint rules for the
  same reason.
- B. Tighten the `@custom-variant dark` selector. **Chosen.** One-line
  change, centralized, durable across `bump-ui`, and as a bonus
  activates `dark:` overrides inside `[data-theme-scope="dark"]` islands
  under a light outer theme — symmetric with the token re-declaration
  blocks already in `globals.css`.

### New selector

```css
@custom-variant dark (&:where([data-theme-scope="dark"], [data-theme-scope="dark"] *, .dark, .dark *, .wall-projector, .wall-projector *):not(:where([data-theme-scope="light"], [data-theme-scope="light"] *)));
```

Rules encoded:

1. `[data-theme-scope="dark"]` and its descendants always count as dark.
2. `.dark` / `.wall-projector` and their descendants count as dark by
   default (matches today's behaviour).
3. The `:not(:where(...))` suffix excludes any element that is — or sits
   under — `[data-theme-scope="light"]`, regardless of the outer theme.
   `:where()` keeps the `:not()` zero-specificity so the resulting
   variant has the same weight as before.

### Known limitation (out of scope)

Re-nested scopes (`light` inside `dark` inside `light`) are not handled:
the outermost `[data-theme-scope="light"]` ancestor always wins the
`:not()` exclusion. The matching token-redeclaration blocks in
`globals.css` rely on CSS custom-property inheritance, which **does**
handle re-nesting through the cascade, so technically the tokens flip
correctly but `dark:` utilities are stuck off inside the innermost dark
island under a light outer scope. No current consumer re-nests, and
this matches the existing JSDoc caveat on `ThemeScope`. Captured in the
updated JSDoc.

## Phases

- **Phase 1 — TDD.** Extend `theme-scope.test.tsx` with five new cases
  that inject a CSS rule matching the new variant selector and assert
  match / no-match per scope/class combination. These are written first;
  with the current variant, three new cases fail (light-scope-under-dark
  is the headline failure). Then update `globals.css` to flip them
  green.

- **Phase 2 — Docs.** Update the JSDoc on
  `src/components/theme/theme-scope.tsx` and the variant comment block
  in `src/app/globals.css` to describe the new behaviour, the list of
  audited components, and the re-nesting limitation. Add a short
  follow-up note on AnalogClock (current consumer) confirming it
  remains semantic-token-only.

- **Phase 3 — Audit record.** Add an `Audit log` block in
  `docs/styling.md` (or a new short doc) listing every `src/components/
ui/` file that uses `dark:`, with a note that the variant tightening
  now neutralizes leakage centrally so no per-file action is required.

## Test plan

Unit (`vitest`):

- New cases in `src/components/theme/__tests__/theme-scope.test.tsx`:
  1. Element under `.dark` (no scope) — matches `dark:`.
  2. Element under `.dark` inside `[data-theme-scope="light"]` — does
     NOT match.
  3. Element under `[data-theme-scope="dark"]` inside `.light` outer —
     matches.
  4. Element under `.wall-projector` inside `[data-theme-scope="light"]`
     — does NOT match.
  5. Element under `[data-theme-scope="dark"]` directly — matches (no
     outer dark class needed).

  These use `Element.matches()` against a stylesheet-injected rule that
  reproduces the new variant selector. This is a CSS-rule-level test —
  it does not depend on Tailwind's full compilation, but it does pin
  the selector behaviour we care about.

Quality:

- `pnpm test`, `pnpm lint:fix`, `pnpm format:fix`, `pnpm check-types`
  — all clean.

## Acceptance criteria (from #324)

- [x] Components in `src/components/ui/` audited; each `dark:` override
      either removed in favour of semantic tokens, or documented why it
      must remain. → Approach B: documented; the leakage is neutralized
      centrally so per-component removal is unnecessary.
- [x] `dark:` leakage caveat in `src/components/theme/theme-scope.tsx`
      JSDoc and `src/app/globals.css` updated to point at the audited list.
- [x] No new ThemeScope consumer regresses. → Existing
      `theme-scope.test.tsx` continues to pass; new cases cover the
      intended cross-scope behaviour.
