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
