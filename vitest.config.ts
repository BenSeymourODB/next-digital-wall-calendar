import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

// Mirror the production React Compiler config (enabled in `next.config.ts`)
// so vitest sees the same auto-memoization that runtime sees. Without
// this, hooks that drop manual `useCallback`/`useMemo` (CLAUDE.md ban,
// enforced via #271) would loop infinitely under tests because their
// inline functions get a new identity every render and re-fire any
// `useEffect` whose dep array references them. See docs/react-compiler.md.
const reactCompilerPlugin: [string, Record<string, unknown>] = [
  "babel-plugin-react-compiler",
  {},
];

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [reactCompilerPlugin],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "e2e", ".claude/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types/**",
        "scripts/",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
