/**
 * Unit tests for the meal-planning service.
 *
 * Tests the create + read paths in isolation with a single mock (prisma).
 * Matches the existing reward-points.ts test pattern: no auth, no
 * NextRequest, no fetch.
 *
 * Per issue #167 acceptance criteria:
 *   "A short unit/integration test exercises one create + one read for
 *    PlannedMeal and GroceryList."
 */
import { prisma } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGroceryList,
  createPlannedMeal,
  getGroceryListForWeek,
  getPlannedMealsForWeek,
} from "../meal-planning";

vi.mock("@/lib/db", () => ({
  prisma: {
    plannedMeal: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    groceryList: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  plannedMeal: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  groceryList: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPlannedMeal", () => {
  it("creates a PlannedMeal with the resolved Monday weekStart", async () => {
    const created = {
      id: "pm-1",
      userId: "user-1",
      mealId: "meal-1",
      weekStart: new Date("2026-04-27T00:00:00.000Z"), // Monday
      dayOfWeek: "wednesday",
      mealType: "dinner",
      createdAt: new Date(),
    };
    mockPrisma.plannedMeal.create.mockResolvedValue(created);

    const result = await createPlannedMeal({
      userId: "user-1",
      mealId: "meal-1",
      // any day in the week of 2026-04-27 should resolve to that Monday
      weekStart: new Date("2026-04-29T14:23:11.000Z"),
      dayOfWeek: "wednesday",
      mealType: "dinner",
    });

    expect(result).toBe(created);
    expect(mockPrisma.plannedMeal.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.plannedMeal.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        mealId: "meal-1",
        weekStart: new Date("2026-04-27T00:00:00.000Z"),
        dayOfWeek: "wednesday",
        mealType: "dinner",
      },
    });
  });

  it("propagates Prisma unique-constraint errors so callers can surface a 409", async () => {
    mockPrisma.plannedMeal.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    await expect(
      createPlannedMeal({
        userId: "user-1",
        mealId: "meal-1",
        weekStart: new Date("2026-04-27T00:00:00.000Z"),
        dayOfWeek: "wednesday",
        mealType: "dinner",
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("getPlannedMealsForWeek", () => {
  it("queries PlannedMeals scoped to (userId, weekStart) with the meal eagerly loaded", async () => {
    const rows = [
      {
        id: "pm-1",
        userId: "user-1",
        mealId: "meal-1",
        weekStart: new Date("2026-04-27T00:00:00.000Z"),
        dayOfWeek: "monday",
        mealType: "breakfast",
        createdAt: new Date(),
        meal: { id: "meal-1", name: "Pancakes", type: "breakfast" },
      },
    ];
    mockPrisma.plannedMeal.findMany.mockResolvedValue(rows);

    const result = await getPlannedMealsForWeek(
      "user-1",
      new Date("2026-04-29T14:23:11.000Z")
    );

    expect(result).toBe(rows);
    expect(mockPrisma.plannedMeal.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.plannedMeal.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        weekStart: new Date("2026-04-27T00:00:00.000Z"),
      },
      include: { meal: true },
      orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
    });
  });

  it("returns an empty array when no plans exist for the week", async () => {
    mockPrisma.plannedMeal.findMany.mockResolvedValue([]);

    const result = await getPlannedMealsForWeek(
      "user-1",
      new Date("2026-04-27T00:00:00.000Z")
    );

    expect(result).toEqual([]);
  });
});

describe("createGroceryList", () => {
  it("creates a GroceryList with the resolved Monday weekStart and a default name", async () => {
    const created = {
      id: "gl-1",
      userId: "user-1",
      weekStart: new Date("2026-04-27T00:00:00.000Z"),
      name: "Week of 2026-04-27",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.groceryList.create.mockResolvedValue(created);

    const result = await createGroceryList({
      userId: "user-1",
      weekStart: new Date("2026-04-29T14:23:11.000Z"),
    });

    expect(result).toBe(created);
    expect(mockPrisma.groceryList.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.groceryList.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        weekStart: new Date("2026-04-27T00:00:00.000Z"),
        name: "Week of 2026-04-27",
      },
    });
  });

  it("uses the caller-supplied name when provided", async () => {
    mockPrisma.groceryList.create.mockResolvedValue({} as never);

    await createGroceryList({
      userId: "user-1",
      weekStart: new Date("2026-04-27T00:00:00.000Z"),
      name: "Easter weekend",
    });

    expect(mockPrisma.groceryList.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Easter weekend" }),
    });
  });
});

describe("getGroceryListForWeek", () => {
  it("returns the grocery list for the week with items ordered by category + order", async () => {
    const list = {
      id: "gl-1",
      userId: "user-1",
      weekStart: new Date("2026-04-27T00:00:00.000Z"),
      name: "Week of 2026-04-27",
      items: [
        {
          id: "i-1",
          listId: "gl-1",
          name: "Milk",
          category: "dairy",
          order: 0,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.groceryList.findFirst.mockResolvedValue(list);

    const result = await getGroceryListForWeek(
      "user-1",
      new Date("2026-04-29T14:23:11.000Z")
    );

    expect(result).toBe(list);
    expect(mockPrisma.groceryList.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.groceryList.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        weekStart: new Date("2026-04-27T00:00:00.000Z"),
      },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
    });
  });

  it("returns null when no grocery list has been started for the week", async () => {
    mockPrisma.groceryList.findFirst.mockResolvedValue(null);

    const result = await getGroceryListForWeek(
      "user-1",
      new Date("2026-04-27T00:00:00.000Z")
    );

    expect(result).toBeNull();
  });
});

describe("week-start normalization", () => {
  // Sanity-check the Monday-resolution used by every create/read path.
  // We can't import getMondayOfWeek directly without exposing it; the
  // public surface exercises it via the createGroceryList path.
  it.each([
    // [input, expected Monday]
    ["2026-04-27T00:00:00.000Z", "2026-04-27T00:00:00.000Z"], // Monday
    ["2026-04-28T05:30:00.000Z", "2026-04-27T00:00:00.000Z"], // Tuesday
    ["2026-05-03T23:59:59.000Z", "2026-04-27T00:00:00.000Z"], // Sunday
    ["2026-04-30T12:00:00.000Z", "2026-04-27T00:00:00.000Z"], // Thursday
  ])("input %s resolves to weekStart %s", async (input, expected) => {
    mockPrisma.groceryList.create.mockResolvedValue({} as never);

    await createGroceryList({
      userId: "user-1",
      weekStart: new Date(input),
    });

    expect(mockPrisma.groceryList.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ weekStart: new Date(expected) }),
    });
  });
});
