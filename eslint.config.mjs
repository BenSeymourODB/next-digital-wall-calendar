import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import localRules from "./eslint-local-rules.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Custom local rules for Application Insights
  {
    plugins: {
      local: localRules,
    },
    rules: {
      "local/no-direct-appinsights-client-import": "error",
      "local/no-direct-appinsights-server-import": "error",
      "local/prefer-logger-over-console": "warn",
    },
  },
  // #271: ban manual memoization (`useMemo`, `useCallback`, `React.memo`).
  // The React Compiler memoizes automatically — see docs/react-compiler.md.
  // Vendored shadcn code under `src/components/ui/**` is excluded by the
  // global ignore below.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useMemo", "useCallback", "memo"],
              message:
                "Manual memoization is forbidden — the React Compiler memoizes automatically. See docs/react-compiler.md.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // Catches `React.memo(...)`, `React.useMemo(...)`,
          // `React.useCallback(...)` accessed via default or namespace
          // imports (`import React from "react"` /
          // `import * as React from "react"`).
          selector:
            "MemberExpression[object.name='React'][property.name=/^(memo|useMemo|useCallback)$/]",
          message:
            "Manual memoization (`React.memo` / `React.useMemo` / `React.useCallback`) is forbidden — the React Compiler memoizes automatically. See docs/react-compiler.md.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "src/components/ui/**",
    "src/lib/utils.ts",
    "src/hooks/use-mobile.ts",
    ".agent-os/**",
    ".vscode/**",
    ".github/**",
  ]),
]);

export default eslintConfig;
