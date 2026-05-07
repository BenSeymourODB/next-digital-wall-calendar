import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  readMigrationEntries,
  validateMigrationNames,
} from "../check-migration-naming.mjs";

const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");

describe("prisma/migrations on-disk state", () => {
  it("has no validation errors (no bad names, gaps, or duplicates)", () => {
    // Belt-and-suspenders companion to the unit tests: the unit tests cover
    // the pure validator, this test catches the exact failure mode that
    // surfaced in #343 — duplicate prefixes landing on main between two PRs
    // that did not rebase on each other. Failing here gives a fast local
    // signal before a duplicate hits CI.
    const entries = readMigrationEntries(migrationsDir);
    expect(validateMigrationNames(entries)).toEqual([]);
  });
});
