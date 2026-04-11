import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const PRISMA_DIR = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(PRISMA_DIR, "migrations");
const SCHEMA_PATH = path.join(PRISMA_DIR, "schema.prisma");

describe("Prisma migration setup", () => {
  it("should have a schema.prisma file", () => {
    expect(fs.existsSync(SCHEMA_PATH)).toBe(true);
  });

  it("should have a migrations directory", () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
    expect(fs.statSync(MIGRATIONS_DIR).isDirectory()).toBe(true);
  });

  it("should have a migration_lock.toml with postgresql provider", () => {
    const lockPath = path.join(MIGRATIONS_DIR, "migration_lock.toml");
    expect(fs.existsSync(lockPath)).toBe(true);

    const content = fs.readFileSync(lockPath, "utf-8");
    expect(content).toContain('provider = "postgresql"');
  });

  it("should have the initial baseline migration", () => {
    const initialMigrationDir = path.join(MIGRATIONS_DIR, "0001_initial");
    expect(fs.existsSync(initialMigrationDir)).toBe(true);

    const migrationSql = path.join(initialMigrationDir, "migration.sql");
    expect(fs.existsSync(migrationSql)).toBe(true);
  });

  it("should have valid SQL in the initial migration", () => {
    const migrationSql = path.join(
      MIGRATIONS_DIR,
      "0001_initial",
      "migration.sql"
    );
    const content = fs.readFileSync(migrationSql, "utf-8");

    // Should contain CREATE TABLE statements for all models in the schema
    const expectedTables = [
      "User",
      "Account",
      "Session",
      "VerificationToken",
      "UserSettings",
      "TaskListConfig",
      "RewardPoints",
      "Profile",
      "ProfileRewardPoints",
      "PointTransaction",
      "ProfileSettings",
      "TaskAssignment",
    ];

    for (const table of expectedTables) {
      expect(content).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("should have enum definitions in the initial migration", () => {
    const migrationSql = path.join(
      MIGRATIONS_DIR,
      "0001_initial",
      "migration.sql"
    );
    const content = fs.readFileSync(migrationSql, "utf-8");

    expect(content).toContain('CREATE TYPE "ProfileType"');
    expect(content).toContain('CREATE TYPE "AgeGroup"');
  });

  it("should have foreign key constraints in the initial migration", () => {
    const migrationSql = path.join(
      MIGRATIONS_DIR,
      "0001_initial",
      "migration.sql"
    );
    const content = fs.readFileSync(migrationSql, "utf-8");

    // Should have foreign key constraints
    expect(content).toContain("ADD CONSTRAINT");
    expect(content).toContain("FOREIGN KEY");
    expect(content).toContain("REFERENCES");
  });

  it("should have indexes in the initial migration", () => {
    const migrationSql = path.join(
      MIGRATIONS_DIR,
      "0001_initial",
      "migration.sql"
    );
    const content = fs.readFileSync(migrationSql, "utf-8");

    // Should have unique and non-unique indexes
    expect(content).toContain("CREATE UNIQUE INDEX");
    expect(content).toContain("CREATE INDEX");
  });

  it("should have all migration directories containing a migration.sql file", () => {
    const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
    const migrationDirs = entries.filter(
      (e) => e.isDirectory() && e.name !== "__tests__"
    );

    expect(migrationDirs.length).toBeGreaterThan(0);

    for (const dir of migrationDirs) {
      const sqlPath = path.join(MIGRATIONS_DIR, dir.name, "migration.sql");
      expect(
        fs.existsSync(sqlPath),
        `Migration directory ${dir.name} is missing migration.sql`
      ).toBe(true);

      const content = fs.readFileSync(sqlPath, "utf-8");
      expect(
        content.trim().length,
        `Migration ${dir.name}/migration.sql is empty`
      ).toBeGreaterThan(0);
    }
  });
});

describe("package.json migration scripts", () => {
  it("should have all required migration scripts", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.scripts["db:migrate"]).toBe("prisma migrate dev");
    expect(pkg.scripts["db:migrate:deploy"]).toBe("prisma migrate deploy");
    expect(pkg.scripts["db:migrate:reset"]).toBe("prisma migrate reset");
    expect(pkg.scripts["db:migrate:status"]).toBe("prisma migrate status");
  });

  it("should have postinstall script that generates Prisma client", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.scripts.postinstall).toBe("prisma generate");
  });
});

describe("schema and migration consistency", () => {
  it("should reference the same models in schema and migration", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const migrationContent = fs.readFileSync(
      path.join(MIGRATIONS_DIR, "0001_initial", "migration.sql"),
      "utf-8"
    );

    // Extract model names from schema
    const modelRegex = /^model\s+(\w+)\s*\{/gm;
    const schemaModels: string[] = [];
    let match;
    while ((match = modelRegex.exec(schemaContent)) !== null) {
      schemaModels.push(match[1]);
    }

    // Every schema model should have a CREATE TABLE in the migration
    for (const model of schemaModels) {
      expect(
        migrationContent,
        `Migration is missing CREATE TABLE for model "${model}"`
      ).toContain(`CREATE TABLE "${model}"`);
    }
  });

  it("should reference the same enums in schema and migration", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const migrationContent = fs.readFileSync(
      path.join(MIGRATIONS_DIR, "0001_initial", "migration.sql"),
      "utf-8"
    );

    // Extract enum names from schema
    const enumRegex = /^enum\s+(\w+)\s*\{/gm;
    const schemaEnums: string[] = [];
    let match;
    while ((match = enumRegex.exec(schemaContent)) !== null) {
      schemaEnums.push(match[1]);
    }

    // Every schema enum should have a CREATE TYPE in the migration
    for (const enumName of schemaEnums) {
      expect(
        migrationContent,
        `Migration is missing CREATE TYPE for enum "${enumName}"`
      ).toContain(`CREATE TYPE "${enumName}"`);
    }
  });
});
