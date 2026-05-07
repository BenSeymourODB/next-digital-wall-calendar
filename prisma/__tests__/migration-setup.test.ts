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

describe("Account uniqueness constraints (issue #61)", () => {
  it("schema enforces @@unique([userId, provider]) on Account", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");

    const accountBlockMatch = schemaContent.match(
      /model Account \{[\s\S]*?\n\}/
    );
    expect(
      accountBlockMatch,
      "Account model not found in schema"
    ).not.toBeNull();

    const accountBlock = accountBlockMatch![0];
    expect(accountBlock).toMatch(/@@unique\(\[userId,\s*provider\]\)/);
  });

  it("migration creates a unique index on Account(userId, provider)", () => {
    const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
    const migrationDirs = entries
      .filter((e) => e.isDirectory() && e.name !== "__tests__")
      .map((e) => e.name);

    const combinedSql = migrationDirs
      .map((dir) =>
        fs.readFileSync(
          path.join(MIGRATIONS_DIR, dir, "migration.sql"),
          "utf-8"
        )
      )
      .join("\n");

    const uniqueIndexPattern =
      /CREATE UNIQUE INDEX\s+"[^"]+"\s+ON\s+"Account"\s*\(\s*"userId"\s*,\s*"provider"\s*\)/;
    expect(
      combinedSql,
      "Expected a CREATE UNIQUE INDEX on Account(userId, provider) across migrations"
    ).toMatch(uniqueIndexPattern);
  });
});

function readAllMigrationsCombined(): string {
  const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  return (
    entries
      .filter((e) => e.isDirectory() && e.name !== "__tests__")
      .map((e) => path.join(MIGRATIONS_DIR, e.name, "migration.sql"))
      // Skip directories without a migration.sql so a partial / accidental
      // directory yields a clear assertion failure (via a separate test
      // that checks every migration dir contains a migration.sql) rather
      // than an unrelated ENOENT here.
      .filter((p) => fs.existsSync(p))
      .map((p) => fs.readFileSync(p, "utf-8"))
      .join("\n")
  );
}

describe("schema and migration consistency", () => {
  it("should reference the same models across all migrations", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const combinedSql = readAllMigrationsCombined();

    // Extract model names from schema
    const modelRegex = /^model\s+(\w+)\s*\{/gm;
    const schemaModels: string[] = [];
    let match;
    while ((match = modelRegex.exec(schemaContent)) !== null) {
      schemaModels.push(match[1]);
    }

    // Every schema model should have a CREATE TABLE in some migration
    for (const model of schemaModels) {
      expect(
        combinedSql,
        `Migrations are missing CREATE TABLE for model "${model}"`
      ).toContain(`CREATE TABLE "${model}"`);
    }
  });

  it("should reference the same enums across all migrations", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const combinedSql = readAllMigrationsCombined();

    // Extract enum names from schema
    const enumRegex = /^enum\s+(\w+)\s*\{/gm;
    const schemaEnums: string[] = [];
    let match;
    while ((match = enumRegex.exec(schemaContent)) !== null) {
      schemaEnums.push(match[1]);
    }

    // Every schema enum should have a CREATE TYPE in some migration
    for (const enumName of schemaEnums) {
      expect(
        combinedSql,
        `Migrations are missing CREATE TYPE for enum "${enumName}"`
      ).toContain(`CREATE TYPE "${enumName}"`);
    }
  });
});

describe("meal planning schema (issue #167)", () => {
  const MEAL_MIGRATION_DIR = path.join(
    MIGRATIONS_DIR,
    "0005_add_meal_planning"
  );

  it("declares the MealType and DayOfWeek enums", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");

    expect(schemaContent).toMatch(/enum\s+MealType\s*\{[\s\S]*?breakfast/);
    expect(schemaContent).toMatch(/enum\s+MealType\s*\{[\s\S]*?lunch/);
    expect(schemaContent).toMatch(/enum\s+MealType\s*\{[\s\S]*?dinner/);
    expect(schemaContent).toMatch(/enum\s+MealType\s*\{[\s\S]*?snack/);

    for (const day of [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]) {
      expect(schemaContent).toMatch(
        new RegExp(`enum\\s+DayOfWeek\\s*\\{[\\s\\S]*?${day}`)
      );
    }
  });

  it("declares the meal-planning models", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");

    for (const model of [
      "Meal",
      "PlannedMeal",
      "MealIngredient",
      "GroceryList",
      "GroceryListItem",
      "SavedMeal",
      "MealTemplate",
    ]) {
      expect(
        schemaContent,
        `schema.prisma is missing model "${model}"`
      ).toMatch(new RegExp(`^model\\s+${model}\\s*\\{`, "m"));
    }
  });

  it("Meal model indexes (userId, type) and references the recipe id as a plain string", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const mealBlockMatch = schemaContent.match(/model Meal \{[\s\S]*?\n\}/);
    expect(mealBlockMatch, "Meal model not found").not.toBeNull();
    const mealBlock = mealBlockMatch![0];

    expect(mealBlock).toMatch(/@@index\(\[userId,\s*type\]\)/);
    expect(mealBlock).toMatch(/recipeId\s+String\?/);
    expect(mealBlock).toMatch(/profileId\s+String\?/);
    expect(mealBlock).toMatch(/servings\s+Int/);
    expect(mealBlock).toMatch(/notes\s+String\?/);
  });

  it("PlannedMeal enforces the (userId, weekStart, dayOfWeek, mealType) unique constraint", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const blockMatch = schemaContent.match(/model PlannedMeal \{[\s\S]*?\n\}/);
    expect(blockMatch, "PlannedMeal model not found").not.toBeNull();
    const block = blockMatch![0];

    expect(block).toMatch(
      /@@unique\(\[userId,\s*weekStart,\s*dayOfWeek,\s*mealType\]\)/
    );
  });

  it("GroceryList belongs to a User and has items keyed by listId", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const groceryListBlock = schemaContent.match(
      /model GroceryList \{[\s\S]*?\n\}/
    );
    const groceryItemBlock = schemaContent.match(
      /model GroceryListItem \{[\s\S]*?\n\}/
    );

    expect(groceryListBlock, "GroceryList model not found").not.toBeNull();
    expect(groceryItemBlock, "GroceryListItem model not found").not.toBeNull();

    expect(groceryListBlock![0]).toMatch(/userId\s+String/);
    expect(groceryListBlock![0]).toMatch(/weekStart\s+DateTime/);
    // One list per user per week — guards getGroceryListForWeek's
    // findFirst contract against concurrent inserts.
    expect(groceryListBlock![0]).toMatch(/@@unique\(\[userId,\s*weekStart\]\)/);
    expect(groceryItemBlock![0]).toMatch(/listId\s+String/);
    expect(groceryItemBlock![0]).toMatch(/isChecked\s+Boolean/);
    expect(groceryItemBlock![0]).toMatch(/mealId\s+String\?/);
  });

  it("SavedMeal.lastUsed is nullable so a never-used meal is distinguishable", () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const block = schemaContent.match(/model SavedMeal \{[\s\S]*?\n\}/);
    expect(block, "SavedMeal model not found").not.toBeNull();

    expect(block![0]).toMatch(/lastUsed\s+DateTime\?/);
    expect(block![0]).not.toMatch(/lastUsed\s+DateTime\s+@default\(now\(\)\)/);
  });

  it("creates a 0005_add_meal_planning migration with the new tables", () => {
    expect(
      fs.existsSync(MEAL_MIGRATION_DIR),
      "0005_add_meal_planning migration directory missing"
    ).toBe(true);

    const sqlPath = path.join(MEAL_MIGRATION_DIR, "migration.sql");
    expect(fs.existsSync(sqlPath)).toBe(true);

    const content = fs.readFileSync(sqlPath, "utf-8");
    for (const table of [
      "Meal",
      "PlannedMeal",
      "MealIngredient",
      "GroceryList",
      "GroceryListItem",
      "SavedMeal",
      "MealTemplate",
    ]) {
      expect(
        content,
        `0005 migration is missing CREATE TABLE for "${table}"`
      ).toContain(`CREATE TABLE "${table}"`);
    }

    expect(content).toContain('CREATE TYPE "MealType"');
    expect(content).toContain('CREATE TYPE "DayOfWeek"');

    // PlannedMeal unique constraint expressed as a unique index
    expect(content).toMatch(
      /CREATE UNIQUE INDEX\s+"[^"]+"\s+ON\s+"PlannedMeal"\s*\(\s*"userId"\s*,\s*"weekStart"\s*,\s*"dayOfWeek"\s*,\s*"mealType"\s*\)/
    );

    // GroceryList unique constraint enforces one list per (userId, weekStart)
    expect(content).toMatch(
      /CREATE UNIQUE INDEX\s+"[^"]+"\s+ON\s+"GroceryList"\s*\(\s*"userId"\s*,\s*"weekStart"\s*\)/
    );

    // Meal index for fast lookup
    expect(content).toMatch(
      /CREATE INDEX\s+"[^"]+"\s+ON\s+"Meal"\s*\(\s*"userId"\s*,\s*"type"\s*\)/
    );

    // SavedMeal.lastUsed is nullable (no DEFAULT, no NOT NULL)
    expect(content).toMatch(/"lastUsed"\s+TIMESTAMP\(3\),/);
    expect(content).not.toMatch(
      /"lastUsed"\s+TIMESTAMP\(3\)\s+NOT NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/
    );
  });
});
