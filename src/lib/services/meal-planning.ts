/**
 * Meal-planning service.
 *
 * Encapsulates the create/read paths for `PlannedMeal` and
 * `GroceryList` so business logic (specifically the
 * "weekStart must be the Monday of the target week" invariant) lives
 * in one testable unit and route handlers only deal with auth,
 * validation, and response shaping.
 */
import type {
  DayOfWeek,
  GroceryList,
  GroceryListItem,
  Meal,
  MealType,
  PlannedMeal,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve any date in a calendar week to the Monday at UTC midnight.
 * `PlannedMeal.@@unique([userId, weekStart, dayOfWeek, mealType])` is
 * keyed on `weekStart`, so all callers must agree on the same anchor.
 */
function getMondayOfWeek(date: Date): Date {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  // JS getUTCDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  // We want Monday, so map Sunday (0) to 6 days back, otherwise day - 1.
  const day = new Date(utc).getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(utc - offset * MS_PER_DAY);
}

export interface CreatePlannedMealInput {
  userId: string;
  mealId: string;
  weekStart: Date;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
}

export async function createPlannedMeal(
  input: CreatePlannedMealInput
): Promise<PlannedMeal> {
  return prisma.plannedMeal.create({
    data: {
      userId: input.userId,
      mealId: input.mealId,
      weekStart: getMondayOfWeek(input.weekStart),
      dayOfWeek: input.dayOfWeek,
      mealType: input.mealType,
    },
  });
}

export type PlannedMealWithMeal = PlannedMeal & { meal: Meal };

export async function getPlannedMealsForWeek(
  userId: string,
  weekStart: Date
): Promise<PlannedMealWithMeal[]> {
  return prisma.plannedMeal.findMany({
    where: {
      userId,
      weekStart: getMondayOfWeek(weekStart),
    },
    include: { meal: true },
    orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
  }) as Promise<PlannedMealWithMeal[]>;
}

export interface CreateGroceryListInput {
  userId: string;
  weekStart: Date;
  name?: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function createGroceryList(
  input: CreateGroceryListInput
): Promise<GroceryList> {
  const monday = getMondayOfWeek(input.weekStart);
  return prisma.groceryList.create({
    data: {
      userId: input.userId,
      weekStart: monday,
      name: input.name ?? `Week of ${isoDate(monday)}`,
    },
  });
}

export type GroceryListWithItems = GroceryList & { items: GroceryListItem[] };

export async function getGroceryListForWeek(
  userId: string,
  weekStart: Date
): Promise<GroceryListWithItems | null> {
  return prisma.groceryList.findFirst({
    where: {
      userId,
      weekStart: getMondayOfWeek(weekStart),
    },
    include: {
      items: {
        orderBy: [{ category: "asc" }, { order: "asc" }],
      },
    },
  }) as Promise<GroceryListWithItems | null>;
}
