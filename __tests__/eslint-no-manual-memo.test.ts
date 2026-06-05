import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Integration tests for the project's ESLint config (#271).
 *
 * Manual memoization (`useMemo`, `useCallback`, `React.memo`) is forbidden
 * by CLAUDE.md because the project uses the React Compiler. These tests
 * lint sample sources against the real `eslint.config.mjs` and assert
 * that the corresponding rules fire — and that legitimate React code is
 * still accepted.
 *
 * Vendored shadcn components under `src/components/ui/**` are globally
 * ignored and are NOT exercised here.
 */

const cwd = path.resolve(__dirname, "..");

function eslint() {
  // useEslintrc / overrideConfigFile defaults pick up the project's
  // flat config (`eslint.config.mjs`) automatically.
  return new ESLint({ cwd, errorOnUnmatchedPattern: false });
}

const fixtureFile = "src/__lint_fixture__.tsx";

async function lint(source: string) {
  const results = await eslint().lintText(source, { filePath: fixtureFile });
  const messages = results.flatMap((r) => r.messages);
  return messages;
}

describe("eslint config: manual memoization ban (#271)", () => {
  it("flags `useMemo` named imported from react", async () => {
    const messages = await lint(
      `import { useMemo } from "react";\nexport const value = useMemo(() => 1, []);\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "no-restricted-imports" &&
          typeof m.message === "string" &&
          /useMemo|memoization/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `useCallback` named imported from react", async () => {
    const messages = await lint(
      `import { useCallback } from "react";\nexport const cb = useCallback(() => {}, []);\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "no-restricted-imports" &&
          typeof m.message === "string" &&
          /useCallback|memoization/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `memo` named imported from react", async () => {
    const messages = await lint(
      `import { memo } from "react";\nexport const Wrapped = memo(function X() { return null; });\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "no-restricted-imports" &&
          typeof m.message === "string" &&
          /memo|memoization/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `React.memo` member access via namespace import", async () => {
    const messages = await lint(
      `import * as React from "react";\nexport const Wrapped = React.memo(function X() { return null; });\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" &&
          typeof m.message === "string" &&
          /React\.memo|memoization/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `React.useMemo` member access via namespace import", async () => {
    const messages = await lint(
      `import * as React from "react";\nexport const value = React.useMemo(() => 1, []);\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" &&
          typeof m.message === "string" &&
          /React\.useMemo|memoization/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `React.useCallback` member access via default import", async () => {
    const messages = await lint(
      `import React from "react";\nexport const cb = React.useCallback(() => {}, []);\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" &&
          typeof m.message === "string" &&
          /React\.useCallback|memoization/i.test(m.message)
      )
    ).toBe(true);
  });

  it("does NOT flag legitimate React hooks", async () => {
    const messages = await lint(
      `import { useState, useEffect, useRef } from "react";\nexport function useThing() {\n  const [x, setX] = useState(0);\n  useEffect(() => {}, []);\n  const r = useRef<number | null>(null);\n  return { x, setX, r };\n}\n`
    );
    const violations = messages.filter(
      (m) =>
        m.ruleId === "no-restricted-imports" ||
        m.ruleId === "no-restricted-syntax"
    );
    expect(violations).toEqual([]);
  });

  it("does NOT flag `memo` imported from a non-react module", async () => {
    // The ban is scoped to imports from `react` only; a util named
    // `memo` from another module is fine.
    const messages = await lint(
      `import { memo } from "lodash-es";\nexport const m = memo;\n`
    );
    const violations = messages.filter(
      (m) =>
        m.ruleId === "no-restricted-imports" ||
        m.ruleId === "local/no-react-manual-memoization"
    );
    expect(violations).toEqual([]);
  });

  // Aliasing-coverage tests (Finding 1 in PR #353 review): the previous
  // `no-restricted-syntax` selector only matched `React.*` by literal name
  // and missed `import * as Foo from "react"; Foo.memo(...)`. The custom
  // `local/no-react-manual-memoization` rule tracks bindings so every
  // alias form is caught. These tests pin that contract.

  it("flags `memo` imported with an alias from react", async () => {
    const messages = await lint(
      `import { memo as M } from "react";\nexport const W = M(function X() { return null; });\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" ||
          (m.ruleId === "no-restricted-imports" && /memo/i.test(m.message))
      )
    ).toBe(true);
  });

  it("flags `Foo.memo` when react is namespace-imported as a non-`React` name", async () => {
    const messages = await lint(
      `import * as Foo from "react";\nexport const W = Foo.memo(function X() { return null; });\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" &&
          /memo/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `R.useMemo` when react is default-imported as a non-`React` name", async () => {
    const messages = await lint(
      `import R from "react";\nexport const v = R.useMemo(() => 1, []);\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" &&
          /useMemo/i.test(m.message)
      )
    ).toBe(true);
  });

  it("flags `useMemo` aliased on import via the local rule even though the alias differs", async () => {
    const messages = await lint(
      `import { useMemo as um } from "react";\nexport const v = um(() => 1, []);\n`
    );
    expect(
      messages.some(
        (m) =>
          m.ruleId === "local/no-react-manual-memoization" &&
          /useMemo/i.test(m.message)
      )
    ).toBe(true);
  });
});
