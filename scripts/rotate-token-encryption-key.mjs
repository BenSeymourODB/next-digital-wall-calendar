#!/usr/bin/env node
// In-place re-encryption of OAuth tokens after a TOKEN_ENCRYPTION_KEY
// rotation (#215). Reads the active and previous keys from env, walks
// the Account table in batches, decrypts each non-null token (dual-read
// in the cipher tries the active key first then the previous one), and
// re-encrypts under the active key. Legacy plaintext tokens are left
// alone — the next session refresh writes them as v1 envelopes
// naturally.
//
// Usage:
//   node scripts/rotate-token-encryption-key.mjs [--dry-run] [--batch-size=N]
//
// Required env:
//   TOKEN_ENCRYPTION_KEY            New (active) key, base64, 32 bytes
//   TOKEN_ENCRYPTION_KEY_PREVIOUS   Previous key, base64, 32 bytes
//   DATABASE_URL                    Prisma connection string
//
// See docs/auth-token-encryption.md for the full runbook.
import process from "node:process";

/**
 * @typedef {{
 *   id: string;
 *   access_token: string | null;
 *   refresh_token: string | null;
 *   id_token: string | null;
 * }} AccountTokenRow
 */

/**
 * @typedef {{
 *   encryptToken: (s: string | null | undefined) => string | null;
 *   decryptToken: (s: string | null | undefined) => string | null;
 *   isEncrypted: (s: string | null | undefined) => boolean;
 * }} CipherApi
 */

/** Fields the rotation considers. Mirrors the Prisma Account model. */
const TOKEN_FIELDS = /** @type {const} */ ([
  "access_token",
  "refresh_token",
  "id_token",
]);

/**
 * Pure re-encrypt step: given an Account row and a cipher API, return
 * the partial update payload that re-encrypts every encrypted token
 * column under the active key. Legacy plaintext fields are not
 * touched. Null fields are not touched.
 *
 * Returns `null` when nothing in the row needs writing (a legacy-only
 * row or a row with no token columns at all).
 *
 * Throws if a non-null encrypted field cannot be decrypted with either
 * key — the caller should surface the failure rather than silently
 * skip the row.
 *
 * @param {AccountTokenRow} row
 * @param {CipherApi} cipher
 * @returns {Partial<Record<typeof TOKEN_FIELDS[number], string>> | null}
 */
export function reencryptAccountTokens(row, cipher) {
  /** @type {Partial<Record<typeof TOKEN_FIELDS[number], string>>} */
  const update = {};
  let dirty = false;

  for (const field of TOKEN_FIELDS) {
    const value = row[field];
    if (value == null) continue;
    if (!cipher.isEncrypted(value)) continue;

    const plaintext = cipher.decryptToken(value);
    if (plaintext == null) {
      // decryptToken only returns null on null input — we already
      // guarded above. Defensive: bail out if Node's typings ever
      // narrow differently in future.
      continue;
    }
    const reencrypted = cipher.encryptToken(plaintext);
    if (reencrypted == null) {
      throw new Error(
        `encryptToken returned null for a non-null plaintext (row ${row.id}, field ${field})`
      );
    }
    update[field] = reencrypted;
    dirty = true;
  }

  return dirty ? update : null;
}

/**
 * Parse a CLI `--flag=value` / `--flag value` pair into a flat record.
 *
 * @param {string[]} argv
 * @returns {{ dryRun: boolean; batchSize: number }}
 */
export function parseArgs(argv) {
  let dryRun = false;
  let batchSize = 100;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--batch-size=")) {
      batchSize = Number(arg.slice("--batch-size=".length));
      continue;
    }
    if (arg === "--batch-size") {
      batchSize = Number(argv[++i]);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10000) {
    throw new Error(
      `--batch-size must be a positive integer ≤ 10000 (got ${batchSize})`
    );
  }

  return { dryRun, batchSize };
}

function printUsageAndExit(code) {
  const out = code === 0 ? process.stdout : process.stderr;
  out.write(
    "Usage: node scripts/rotate-token-encryption-key.mjs [--dry-run] [--batch-size=N]\n" +
      "\n" +
      "Required env:\n" +
      "  TOKEN_ENCRYPTION_KEY            New (active) key (base64, 32 bytes)\n" +
      "  TOKEN_ENCRYPTION_KEY_PREVIOUS   Previous key (base64, 32 bytes)\n" +
      "  DATABASE_URL                    Prisma connection string\n"
  );
  process.exit(code);
}

/**
 * Refuse to run unless the operator has both keys set AND they are
 * actually different — both signals that a rotation is in progress.
 * Defers the actual decode validation to the cipher (`encryptToken` /
 * `decryptToken` calls trip the env validators on first use), so the
 * error messages from this script and from runtime stay consistent.
 */
function assertRotationEnv() {
  const active = process.env.TOKEN_ENCRYPTION_KEY;
  const previous = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;

  if (!active || active.length === 0) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required (the new / active key for re-encryption)."
    );
  }
  if (!previous || previous.length === 0) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY_PREVIOUS is required (the old key being rotated out)."
    );
  }
  if (active.trim() === previous.trim()) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY and TOKEN_ENCRYPTION_KEY_PREVIOUS are identical — nothing to rotate."
    );
  }
}

/**
 * Entry point. Wires Prisma + cipher and walks the table.
 *
 * Extracted so the unit tests can exercise the pure helpers (the
 * `reencryptAccountTokens` / `parseArgs` exports) without booting
 * Prisma.
 *
 * @param {string[]} argv
 */
export async function main(argv) {
  const { dryRun, batchSize } = parseArgs(argv);
  assertRotationEnv();

  // Lazy-imported so `import("../rotate-token-encryption-key.mjs")` in
  // tests doesn't pull in Prisma's heavy native bindings.
  const cipher = await import("../src/lib/crypto/token-cipher.ts");
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const startedAt = Date.now();
  let scanned = 0;
  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    /** @type {string | null} */
    let cursor = null;
    for (;;) {
      const batch = await prisma.account.findMany({
        where: {
          OR: [
            { access_token: { not: null } },
            { refresh_token: { not: null } },
            { id_token: { not: null } },
          ],
        },
        select: {
          id: true,
          access_token: true,
          refresh_token: true,
          id_token: true,
        },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (batch.length === 0) break;

      const updates = [];
      for (const row of batch) {
        scanned++;
        try {
          const update = reencryptAccountTokens(row, cipher);
          if (!update) {
            skipped++;
            continue;
          }
          updates.push({ id: row.id, data: update });
        } catch (err) {
          failed++;
          process.stderr.write(
            `[rotate] account ${row.id} failed: ${err instanceof Error ? err.message : String(err)}\n`
          );
        }
      }

      if (!dryRun && updates.length > 0) {
        await prisma.$transaction(
          updates.map((u) =>
            prisma.account.update({ where: { id: u.id }, data: u.data })
          )
        );
      }
      rotated += updates.length;
      cursor = batch[batch.length - 1].id;

      process.stdout.write(
        `[rotate] scanned=${scanned} rotated=${rotated} skipped=${skipped} failed=${failed}\n`
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  const elapsedMs = Date.now() - startedAt;
  process.stdout.write(
    `[rotate] done in ${elapsedMs}ms — scanned=${scanned} rotated=${rotated} skipped=${skipped} failed=${failed}${dryRun ? " (dry-run)" : ""}\n`
  );
  if (failed > 0) process.exit(1);
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(
      `[rotate] fatal: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
