"use client";

import type { ReactNode } from "react";

export type ThemeScopeMode = "light" | "dark";

interface ThemeScopeProps {
  mode: ThemeScopeMode;
  children: ReactNode;
  className?: string;
}

/**
 * ThemeScope — opt a subtree into the opposite token scheme regardless of the
 * outer theme. Renders a `[data-theme-scope]` wrapper; CSS rules in
 * globals.css re-declare every shadcn/ui semantic token (--background,
 * --foreground, --card, etc.) within the scope, so any descendant Tailwind
 * utility that resolves through those tokens (e.g. `bg-background`,
 * `text-foreground`, or SVG fills using `var(--card)`) flips automatically.
 *
 * Cross-variant behaviour (issue #324)
 * - The `dark:` Tailwind variant is tightened in globals.css so it does NOT
 *   fire on descendants of `[data-theme-scope="light"]`, even when the outer
 *   theme is `.dark` or `.wall-projector`. Symmetrically, it DOES fire on
 *   descendants of `[data-theme-scope="dark"]` under a light outer theme.
 *   The shadcn components in `src/components/ui/` that ship with `dark:`
 *   overrides (Button outline, Switch thumb, Badge destructive, etc.) are
 *   therefore safe to wrap in a ThemeScope: per-component edits would be
 *   overwritten by `pnpm bump-ui` anyway, so the central variant fix is the
 *   durable solution.
 *
 * Caveats
 * - Re-nested scopes (light → dark → light, etc.) are not handled: the
 *   outermost `[data-theme-scope="light"]` ancestor always wins the
 *   `:not()` exclusion in the `dark:` variant, so `dark:` utilities will be
 *   stuck off inside an innermost re-entered dark island. CSS custom
 *   properties do still re-nest via inheritance, so semantic-token-driven
 *   styling stays correct. No current consumer re-nests.
 * - The wrapper is a plain `<div>`. Pass `className` to control layout
 *   (e.g. preserve `aspect-square`/`flex` parents).
 *
 * Issues: #319 (primitive), #324 (variant tightening).
 */
export function ThemeScope({ mode, children, className }: ThemeScopeProps) {
  return (
    <div data-theme-scope={mode} className={className}>
      {children}
    </div>
  );
}
