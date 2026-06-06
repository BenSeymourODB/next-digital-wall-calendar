import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../.github/workflows/main_nextjs-template-build.yml"
);

let workflow: string;

beforeAll(() => {
  workflow = readFileSync(WORKFLOW_PATH, "utf-8");
});

// Match `- name: <name>` only when followed by a newline so step names that
// are prefixes of other step names (e.g. "Test" vs "Test coverage", "Build"
// vs "Build and cache") cannot false-positive on each other.
function indexOfStep(name: string): number {
  return workflow.indexOf(`- name: ${name}\n`);
}

describe("CI workflow (main_nextjs-template-build.yml)", () => {
  it("declares a Test step that runs the Vitest suite", () => {
    const testIdx = indexOfStep("Test");
    expect(testIdx).toBeGreaterThan(-1);

    const testBlock = workflow.slice(testIdx, testIdx + 200);
    expect(testBlock).toMatch(/run:\s+pnpm test:run/);
  });

  it("runs Test before Build so a failing test fails the job fast", () => {
    const testIdx = indexOfStep("Test");
    const buildIdx = indexOfStep("Build");

    expect(testIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeLessThan(buildIdx);
  });

  it("runs Test after install + lint/typecheck + Prisma migration validation", () => {
    const installIdx = indexOfStep("Install dependencies");
    const lintIdx = indexOfStep("Lint and type check");
    const migrationIdx = workflow.indexOf("Validate Prisma migrations");
    const testIdx = indexOfStep("Test");

    expect(installIdx).toBeGreaterThan(-1);
    expect(lintIdx).toBeGreaterThan(-1);
    expect(migrationIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);

    expect(installIdx).toBeLessThan(testIdx);
    expect(lintIdx).toBeLessThan(testIdx);
    expect(migrationIdx).toBeLessThan(testIdx);
  });
});
