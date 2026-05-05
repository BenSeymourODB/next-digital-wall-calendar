#!/usr/bin/env node
// Validates Prisma migration directory names match the project convention:
// NNNN_snake_case_description, with NNNN a strictly increasing 4-digit prefix
// starting at 0001. See docs/database.md for the rationale.
import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Forbids a trailing underscore and double-underscores (e.g. "0001_add_",
// "0001___") while still accepting "0001_initial" and "0004_add_calendar_settings".
export const MIGRATION_NAME_PATTERN = /^[0-9]{4}_[a-z0-9]+(?:_[a-z0-9]+)*$/;

/**
 * @typedef {{ name: string; isDirectory: boolean }} MigrationEntry
 */

/**
 * Validate a list of migration directory entries.
 *
 * @param {MigrationEntry[]} entries
 * @returns {string[]} list of error messages (empty when everything is valid)
 */
export function validateMigrationNames(entries) {
  const errors = [];

  // Lexicographic sort equals numeric order because prefixes are always
  // zero-padded to exactly 4 digits (0001–9999). Do not switch to a numeric
  // comparator without revisiting the ordering invariant below.
  const dirNames = entries
    .filter((e) => e.isDirectory)
    .map((e) => e.name)
    .sort();

  for (const name of dirNames) {
    if (!MIGRATION_NAME_PATTERN.test(name)) {
      errors.push(
        `Invalid migration name: "${name}". Expected NNNN_snake_case_description (e.g. "0005_add_meal_planning"). See docs/database.md.`
      );
    }
  }

  const valid = dirNames.filter((n) => MIGRATION_NAME_PATTERN.test(n));
  for (let i = 0; i < valid.length; i++) {
    const prefix = Number.parseInt(valid[i].slice(0, 4), 10);
    const expected = i + 1;
    if (prefix !== expected) {
      const expectedPrefix = String(expected).padStart(4, "0");
      errors.push(
        `Migration "${valid[i]}" has prefix ${String(prefix).padStart(4, "0")}, ` +
          `expected ${expectedPrefix}. Prefixes must be strictly sequential ` +
          `starting at 0001 (no gaps, no duplicates).`
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
    `✓ ${count} migration${count === 1 ? "" : "s"} follow the NNNN_snake_case convention`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
