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
 * Caveats
 * - Tailwind's `dark:` variant matches whenever a `.dark` (or
 *   `.wall-projector`) class is on any ancestor, regardless of an opposite
 *   ThemeScope between. Components intended to be wrapped should rely on
 *   semantic tokens rather than `dark:` overrides. The repo-wide audit of
 *   such overrides (e.g. shadcn `Button` `outline` variant) is tracked in
 *   #324.
 * - The wrapper is a plain `<div>`. Pass `className` to control layout
 *   (e.g. preserve `aspect-square`/`flex` parents).
 *
 * Issue: #319.
 */
export function ThemeScope({ mode, children, className }: ThemeScopeProps) {
  return (
    <div data-theme-scope={mode} className={className}>
      {children}
    </div>
  );
}
