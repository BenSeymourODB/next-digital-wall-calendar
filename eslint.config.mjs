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
      // #271: ban manual memoization (`useMemo`, `useCallback`,
      // `React.memo`). The React Compiler memoizes automatically — see
      // docs/react-compiler.md. The custom rule tracks `react` import
      // bindings so it catches every aliasing form (named, named-with-as,
      // default, namespace) — no-restricted-imports below is a belt-and-
      // braces backup that catches the unaliased named-import form even
      // if the local rule is somehow disabled. Vendored shadcn under
      // `src/components/ui/**` is excluded by the global ignore.
      "local/no-react-manual-memoization": "error",
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
    },
  },
  // eslint-config-next 16.2.7 (merged via Dependabot #359) promoted
  // `react-hooks/set-state-in-effect` from off to error, surfacing eight
  // pre-existing violations across the codebase (CalendarProvider,
  // settings-form, give-points-modal, pin-entry-modal, pin-setup-modal,
  // task-list-settings, use-tasks, useWritableCalendars). Downgrade to
  // `warn` so unrelated PRs aren't blocked while the violations are
  // refactored under a dedicated cleanup ticket.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
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
