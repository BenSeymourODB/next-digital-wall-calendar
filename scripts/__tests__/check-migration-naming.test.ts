import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MIGRATION_NAME_PATTERN,
  validateMigrationNames,
} from "../check-migration-naming.mjs";

type Entry = { name: string; isDirectory: boolean };

const dir = (name: string): Entry => ({ name, isDirectory: true });
const file = (name: string): Entry => ({ name, isDirectory: false });

describe("MIGRATION_NAME_PATTERN", () => {
  it("matches the canonical 14-digit timestamp snake-case form", () => {
    expect(MIGRATION_NAME_PATTERN.test("20260502052405_initial")).toBe(true);
    expect(
      MIGRATION_NAME_PATTERN.test("20260506033858_add_meal_planning")
    ).toBe(true);
    expect(
      MIGRATION_NAME_PATTERN.test(
        "20260507135533_pointtransaction_unique_task_award"
      )
    ).toBe(true);
    expect(MIGRATION_NAME_PATTERN.test("99991231235959_x")).toBe(true);
  });

  it("rejects the old 4-digit sequential prefix form", () => {
    expect(MIGRATION_NAME_PATTERN.test("0001_initial")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("0042_add_calendar_settings")).toBe(
      false
    );
    expect(MIGRATION_NAME_PATTERN.test("9999_x")).toBe(false);
  });

  it("rejects short timestamps, uppercase, hyphens, and bare names", () => {
    expect(MIGRATION_NAME_PATTERN.test("2026050205_initial")).toBe(false); // 10 digits
    expect(MIGRATION_NAME_PATTERN.test("202605020524050_initial")).toBe(false); // 15 digits
    expect(MIGRATION_NAME_PATTERN.test("20260502052405_AddSettings")).toBe(
      false
    );
    expect(MIGRATION_NAME_PATTERN.test("20260502052405_add-settings")).toBe(
      false
    );
    expect(MIGRATION_NAME_PATTERN.test("20260502052405")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("20260502052405_")).toBe(false);
  });

  it("rejects trailing or doubled underscores in the description", () => {
    expect(MIGRATION_NAME_PATTERN.test("20260502052405_add_")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("20260502052405___")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("20260502052405_add__settings")).toBe(
      false
    );
    expect(MIGRATION_NAME_PATTERN.test("20260502052405__initial")).toBe(false);
  });
});

describe("validateMigrationNames", () => {
  it("returns no errors for a valid set of ascending timestamps", () => {
    const entries = [
      dir("20260502052405_initial"),
      dir("20260502052406_add_scheduler_settings"),
      dir("20260502052407_unique_account_user_provider"),
      dir("20260502052408_add_calendar_settings"),
      file("migration_lock.toml"),
    ];

    expect(validateMigrationNames(entries)).toEqual([]);
  });

  it("ignores non-directory entries (lock files, README)", () => {
    const entries = [
      file("migration_lock.toml"),
      file("README.md"),
      dir("20260502052405_initial"),
    ];

    expect(validateMigrationNames(entries)).toEqual([]);
  });

  it("accepts gaps between timestamps (non-sequential timestamps are normal)", () => {
    const entries = [
      dir("20260502052405_initial"),
      dir("20260506033858_add_meal_planning"),
      dir("20260507135533_pointtransaction_unique_task_award"),
    ];

    expect(validateMigrationNames(entries)).toEqual([]);
  });

  it("flags a name that doesn't match the regex", () => {
    const entries = [dir("20260502052405_initial"), dir("not-a-migration")];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid migration name: "not-a-migration"');
  });

  it("flags the old 4-digit sequential prefix form", () => {
    const entries = [
      dir("20260502052405_initial"),
      dir("0002_add_scheduler_settings"),
    ];

    const errors = validateMigrationNames(entries);
    expect(errors.some((e) => e.includes("0002_add_scheduler_settings"))).toBe(
      true
    );
  });

  it("flags duplicate 14-digit timestamps", () => {
    const entries = [
      dir("20260502052405_initial"),
      dir("20260502052405_add_settings"),
    ];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("20260502052405");
    expect(errors[0]).toMatch(/[Dd]uplicate/);
  });

  it("flags multiple duplicate timestamps, one error per duplicate group", () => {
    const entries = [
      dir("20260502052405_initial"),
      dir("20260502052405_add_settings"),
      dir("20260506033858_add_meal_planning"),
      dir("20260506033858_another_migration"),
    ];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.includes("20260502052405"))).toBe(true);
    expect(errors.some((e) => e.includes("20260506033858"))).toBe(true);
  });

  it("returns multiple errors when several names break the rules", () => {
    const entries = [
      dir("not-a-migration"),
      dir("20260502052405_initial"),
      dir("0003_old_style"),
    ];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.includes('"not-a-migration"'))).toBe(true);
    expect(errors.some((e) => e.includes('"0003_old_style"'))).toBe(true);
  });

  it("treats an empty migrations directory as valid", () => {
    expect(validateMigrationNames([])).toEqual([]);
    expect(validateMigrationNames([file("migration_lock.toml")])).toEqual([]);
  });

  it("processes names in lexicographic order even when input is shuffled", () => {
    const entries = [
      dir("20260502052407_third"),
      dir("20260502052405_first"),
      dir("20260502052406_second"),
    ];

    expect(validateMigrationNames(entries)).toEqual([]);
  });
});

describe("on-disk regression: actual prisma/migrations directory", () => {
  it("has zero naming errors", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(here, "..", "..", "prisma", "migrations");

    const entries = readdirSync(migrationsDir).map((name) => {
      const fullPath = join(migrationsDir, name);
      return { name, isDirectory: lstatSync(fullPath).isDirectory() };
    });

    const errors = validateMigrationNames(entries);
    expect(errors).toEqual([]);
  });
});
