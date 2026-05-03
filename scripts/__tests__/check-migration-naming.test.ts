import { describe, expect, it } from "vitest";
import {
  MIGRATION_NAME_PATTERN,
  validateMigrationNames,
} from "../check-migration-naming.mjs";

type Entry = { name: string; isDirectory: boolean };

const dir = (name: string): Entry => ({ name, isDirectory: true });
const file = (name: string): Entry => ({ name, isDirectory: false });

describe("MIGRATION_NAME_PATTERN", () => {
  it("matches the canonical 4-digit snake-case form", () => {
    expect(MIGRATION_NAME_PATTERN.test("0001_initial")).toBe(true);
    expect(MIGRATION_NAME_PATTERN.test("0042_add_calendar_settings")).toBe(
      true
    );
    expect(MIGRATION_NAME_PATTERN.test("9999_x")).toBe(true);
  });

  it("rejects short prefixes, uppercase, hyphens, and timestamps", () => {
    expect(MIGRATION_NAME_PATTERN.test("001_initial")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("00001_initial")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("0001_AddSettings")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("0001_add-settings")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("20260427120000_initial")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("0001")).toBe(false);
    expect(MIGRATION_NAME_PATTERN.test("0001_")).toBe(false);
  });
});

describe("validateMigrationNames", () => {
  it("returns no errors for the canonical sequential set", () => {
    const entries = [
      dir("0001_initial"),
      dir("0002_add_scheduler_settings"),
      dir("0003_unique_account_user_provider"),
      dir("0004_add_calendar_settings"),
      file("migration_lock.toml"),
    ];

    expect(validateMigrationNames(entries)).toEqual([]);
  });

  it("ignores non-directory entries (lock files, README)", () => {
    const entries = [
      file("migration_lock.toml"),
      file("README.md"),
      dir("0001_initial"),
    ];

    expect(validateMigrationNames(entries)).toEqual([]);
  });

  it("flags a name that doesn't match the regex", () => {
    const entries = [dir("0001_initial"), dir("not-a-migration")];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid migration name: "not-a-migration"');
  });

  it("flags a Prisma-default timestamp-prefixed name", () => {
    const entries = [dir("0001_initial"), dir("20260427120000_add_settings")];

    const errors = validateMigrationNames(entries);
    expect(errors.some((e) => e.includes("20260427120000_add_settings"))).toBe(
      true
    );
  });

  it("flags a gap in the sequence", () => {
    const entries = [
      dir("0001_initial"),
      dir("0002_second"),
      dir("0004_skipped_three"),
    ];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"0004_skipped_three"');
    expect(errors[0]).toContain("expected 0003");
  });

  it("flags a duplicate prefix", () => {
    const entries = [
      dir("0001_initial"),
      dir("0002_first"),
      dir("0002_second"),
    ];

    const errors = validateMigrationNames(entries);
    // Both 0002s sort after 0001; the second one in sort order is at index 2,
    // expects prefix 0003. Either way, at least one ordering error is reported.
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("0002"))).toBe(true);
  });

  it("flags a sequence that does not start at 0001", () => {
    const entries = [dir("0002_skipped_one"), dir("0003_second")];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("expected 0001");
  });

  it("returns multiple errors when several names break the rules", () => {
    const entries = [
      dir("not-a-migration"),
      dir("0001_initial"),
      dir("0003_skipped_two"),
    ];

    const errors = validateMigrationNames(entries);
    expect(errors).toHaveLength(2);
  });

  it("treats an empty migrations directory as valid", () => {
    expect(validateMigrationNames([])).toEqual([]);
    expect(validateMigrationNames([file("migration_lock.toml")])).toEqual([]);
  });

  it("processes names in numeric order even when input is shuffled", () => {
    const entries = [dir("0003_third"), dir("0001_first"), dir("0002_second")];

    expect(validateMigrationNames(entries)).toEqual([]);
  });
});
