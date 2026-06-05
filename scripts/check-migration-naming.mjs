#!/usr/bin/env node
// Validates Prisma migration directory names match the project convention:
// YYYYMMDDHHMMSS_snake_case_description (Prisma's default timestamp prefix).
// See docs/database.md for rationale.
import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 14-digit timestamp followed by snake_case description.
// Forbids a trailing underscore and double-underscores (e.g.
// "20260502052405_add_", "20260502052405___") while still accepting
// "20260502052405_initial" and "20260506033858_add_meal_planning".
export const MIGRATION_NAME_PATTERN = /^[0-9]{14}_[a-z0-9]+(?:_[a-z0-9]+)*$/;

/**
 * @typedef {{ name: string; isDirectory: boolean }} MigrationEntry
 */

/**
 * Validate a list of migration directory entries.
 *
 * Rules:
 *  1. Every directory name must match MIGRATION_NAME_PATTERN.
 *  2. No two directories may share the same 14-digit timestamp prefix.
 *     Gaps between timestamps are allowed (non-sequential is normal).
 *
 * @param {MigrationEntry[]} entries
 * @returns {string[]} list of error messages (empty when everything is valid)
 */
export function validateMigrationNames(entries) {
  const errors = [];

  const dirNames = entries
    .filter((e) => e.isDirectory)
    .map((e) => e.name)
    .sort();

  for (const name of dirNames) {
    if (!MIGRATION_NAME_PATTERN.test(name)) {
      errors.push(
        `Invalid migration name: "${name}". Expected YYYYMMDDHHMMSS_snake_case_description (e.g. "20260506033858_add_meal_planning"). See docs/database.md.`
      );
    }
  }

  // Detect duplicate 14-digit timestamp prefixes among valid names.
  const valid = dirNames.filter((n) => MIGRATION_NAME_PATTERN.test(n));
  /** @type {Map<string, string[]>} */
  const byTimestamp = new Map();
  for (const name of valid) {
    const ts = name.slice(0, 14);
    const group = byTimestamp.get(ts) ?? [];
    group.push(name);
    byTimestamp.set(ts, group);
  }
  for (const [ts, names] of byTimestamp) {
    if (names.length > 1) {
      errors.push(
        `Duplicate timestamp prefix "${ts}": ${names.map((n) => `"${n}"`).join(", ")}. ` +
          `Each migration must have a unique 14-digit timestamp. See docs/database.md.`
      );
    }
  }

  return errors;
}

/**
 * Read entries (files + directories) from a real filesystem path.
 *
 * @param {string} dir
 * @returns {MigrationEntry[]}
 */
export function readMigrationEntries(dir) {
  // lstatSync (not statSync) so a directory-typed symlink is reported as a
  // symlink, not as a directory. Migration directories should never be
  // symlinks — surfacing them as non-directory entries means they are
  // skipped from validation rather than silently treated as real migrations.
  return readdirSync(dir).map((name) => {
    const fullPath = join(dir, name);
    return { name, isDirectory: lstatSync(fullPath).isDirectory() };
  });
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(here, "..", "prisma", "migrations");

  const entries = readMigrationEntries(migrationsDir);
  const errors = validateMigrationNames(entries);

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`::error::${err}`);
    }
    console.error(
      `\nFound ${errors.length} migration-naming problem(s). Fix the above and re-run.`
    );
    process.exit(1);
  }

  const count = entries.filter((e) => e.isDirectory).length;
  console.log(
    `✓ ${count} migration${count === 1 ? "" : "s"} follow the YYYYMMDDHHMMSS_snake_case convention`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
