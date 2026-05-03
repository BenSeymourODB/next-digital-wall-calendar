import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../.github/workflows/main_nextjs-template-build.yml"
);

const workflow = readFileSync(WORKFLOW_PATH, "utf-8");

function indexOfStep(name: string): number {
  return workflow.indexOf(`- name: ${name}`);
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
