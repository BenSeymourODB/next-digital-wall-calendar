"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface ThemeProviderProps {
  children: ReactNode;
}

// `wall-projector` is a third theme alongside light/dark, intended for
// always-on wall displays: dark chrome with scoped light "islands" via the
// ThemeScope primitive. See issue #319 and src/components/theme/theme-scope.tsx.
const THEMES = ["light", "dark", "wall-projector"] as const;

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={[...THEMES]}
    >
      {children}
    </NextThemesProvider>
  );
}
