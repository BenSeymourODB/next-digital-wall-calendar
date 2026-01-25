# Weekly Meal Planning

## Overview

Implement a weekly meal planning feature that enables families to plan and organize meals (Breakfast, Lunch, Dinner, Snacks) for each day of the week. This helps with grocery shopping, reduces decision fatigue, and brings structure to family meal routines, similar to Skylight's meal planning feature.

## Requirements

### Core Features

#### 1. Weekly Meal Grid

- **7-Day View**: Monday through Sunday meal grid
- **Meal Slots**: Breakfast, Lunch, Dinner, Snack per day
- **Drag and Drop**: Drag meals between slots or days
- **Color Coding**: Visual distinction for meal types
- **Current Day Highlight**: Highlight today's meals
- **Week Navigation**: Navigate to previous/next weeks

#### 2. Meal Management

- **Quick Add**: Simple text input for meal names
- **Meal Library**: Save frequently used meals for reuse
- **Meal Templates**: Pre-filled week templates (e.g., "Meatless Monday")
- **Copy Week**: Duplicate previous week's plan
- **Clear Slot**: Remove meal from slot
- **Notes**: Add notes to meals (e.g., "defrost chicken")

#### 3. Meal Categories

- **Meal Types**:
  - 🌅 Breakfast (e.g., Pancakes, Oatmeal, Eggs)
  - 🌞 Lunch (e.g., Sandwiches, Salad, Leftovers)
  - 🌙 Dinner (e.g., Pasta, Chicken, Pizza)
  - 🍎 Snack (e.g., Fruit, Crackers, Yogurt)

#### 4. Recipe Integration

- **Link to Recipe**: Attach recipe (from recipe display component)
- **View Recipe**: Quick access from meal plan
- **Recipe Preview**: Hover/tap to preview ingredients
- **Add to Grocery List**: Auto-generate ingredients list (future)

#### 5. Grocery List Integration

- **Generate List**: Create grocery list from week's meals
- **Manual Items**: Add non-meal items to list
- **Check Off**: Mark items as purchased
- **Share List**: Export/share via text or email (future)

#### 6. Multi-Profile Support

- **Assign Meals**: Tag meals with who's eating (profiles)
- **Dietary Preferences**: Per-profile dietary tags (vegetarian, allergic to nuts)
- **Portions**: Indicate serving sizes
- **Special Meals**: Mark meals for specific family members

#### 7. Notifications & Reminders

- **Prep Reminders**: Remind to prep meal (e.g., "Defrost chicken for tomorrow")
- **Meal Time Alerts**: Notify at configured meal times
- **Shopping Reminder**: Alert when grocery list is ready
- **Configurable**: Enable/disable per user

### Visual Design

#### Weekly Meal Grid

```
┌──────────────────────────────────────────────────────────────┐
│  Week of Jan 13-19, 2026          [◀ Prev]  [Next ▶]        │
├──────────────────────────────────────────────────────────────┤
│         Mon      Tue      Wed      Thu      Fri  Sat    Sun  │
├──────────────────────────────────────────────────────────────┤
│ 🌅      ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ ┌────┐ ┌────┐
│ Break. │Eggs │  │Oats │  │Toast│  │Cereal│ │Panc.│ │Waf.│ │Free│
│        └─────┘  └─────┘  └─────┘  └─────┘  └─────┘ └────┘ └────┘
│ 🌞      ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ ┌────┐ ┌────┐
│ Lunch  │Sand.│  │Salad│  │Soup │  │Leftov│ │Pizza│ │+   │ │+   │
│        └─────┘  └─────┘  └─────┘  └─────┘  └─────┘ └────┘ └────┘
│ 🌙      ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ ┌────┐ ┌────┐
│ Dinner │Pasta│  │Chick.│ │Tacos│  │Fish │  │BBQ  │ │Steak││+   │
│        └─────┘  └─────┘  └─────┘  └─────┘  └─────┘ └────┘ └────┘
│ 🍎      ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ ┌────┐ ┌────┐
│ Snack  │Fruit│  │Nuts │  │Yogurt│ │+    │  │+    │ │+   │ │+   │
│        └─────┘  └─────┘  └─────┘  └─────┘  └─────┘ └────┘ └────┘
└──────────────────────────────────────────────────────────────┘

Tap [+] to add meal  •  Drag to move  •  Tap card to edit
```

#### Meal Card (Expanded)

```
┌─────────────────────────────────────┐
│  Spaghetti Bolognese       [✏️] [🗑️] │
│  🌙 Dinner  •  Monday              │
│                                     │
│  👨👩👧👦 Whole Family (4 servings)     │
│                                     │
│  📖 Recipe: Italian Bolognese       │
│  [View Recipe]                      │
│                                     │
│  📝 Note: Defrost ground beef       │
│                                     │
│  [Add to Grocery List]              │
└─────────────────────────────────────┘
```

#### Add Meal Modal

```
┌─────────────────────────────────────┐
│  Add Meal                           │
│                                     │
│  Day:                               │
│  ┌──────────────────────────────┐  │
│  │  Monday                     ▼│  │
│  └──────────────────────────────┘  │
│                                     │
│  Meal Type:                         │
│  [🌅] [🌞] [🌙 Selected] [🍎]       │
│                                     │
│  Meal Name:                         │
│  ┌──────────────────────────────┐  │
│  │  Spaghetti Bolognese         │  │
│  └──────────────────────────────┘  │
│                                     │
│  Link Recipe (optional):            │
│  ┌──────────────────────────────┐  │
│  │  Search recipes...          🔍│  │
│  └──────────────────────────────┘  │
│                                     │
│  Servings:                          │
│  ┌──────────────────────────────┐  │
│  │  [4         ]                 │  │
│  └──────────────────────────────┘  │
│                                     │
│  Notes (optional):                  │
│  ┌──────────────────────────────┐  │
│  │  Defrost ground beef day     │  │
│  │  before                      │  │
│  └──────────────────────────────┘  │
│                                     │
│  [Cancel]            [Add Meal]     │
└─────────────────────────────────────┘
```

#### Grocery List (Generated from Meal Plan)

```
┌─────────────────────────────────────┐
│  Grocery List - Week of Jan 13     │
│  [Export] [Clear Checked] [Share]  │
├─────────────────────────────────────┤
│  Proteins                           │
│  ☐ Ground beef (1 lb)               │
│  ☐ Chicken breast (2 lbs)           │
│  ☐ Salmon fillets (4)               │
│                                     │
│  Produce                            │
│  ☑ Tomatoes (6)                     │
│  ☐ Lettuce (1 head)                 │
│  ☐ Onions (3)                       │
│                                     │
│  Dairy                              │
│  ☐ Milk (1 gallon)                  │
│  ☐ Cheese (8 oz)                    │
│  ☐ Yogurt (6 pack)                  │
│                                     │
│  Pantry                             │
│  ☐ Pasta (1 lb)                     │
│  ☐ Rice (2 lbs)                     │
│  ☐ Olive oil                        │
│                                     │
│  Other                              │
│  ☐ [Add item...                  ]  │
└─────────────────────────────────────┘
```

#### Meal Library

```
┌─────────────────────────────────────┐
│  Meal Library               [+ New] │
│  [Search meals...               🔍] │
├─────────────────────────────────────┤
│  Recent                             │
│  ┌──────────────────────────────┐  │
│  │ 🌙 Spaghetti Bolognese       │  │
│  │    Used 3 times              │  │
│  │    [Add to Plan]             │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 🌅 Pancakes                  │  │
│  │    Used 5 times              │  │
│  │    [Add to Plan]             │  │
│  └──────────────────────────────┘  │
│                                     │
│  Favorites                          │
│  ┌──────────────────────────────┐  │
│  │ 🌙 Tacos                ⭐    │  │
│  │    Used 8 times              │  │
│  │    [Add to Plan]             │  │
│  └──────────────────────────────┘  │
│                                     │
│  All Meals (24)                     │
│  [View All]                         │
└─────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Component Structure

```
src/components/meals/
├── meal-planner.tsx             # Main weekly grid component
├── meal-card.tsx                # Individual meal card
├── meal-slot.tsx                # Empty meal slot (+ button)
├── add-meal-modal.tsx           # Add/edit meal modal
├── meal-library.tsx             # Saved meals library
├── meal-template-picker.tsx    # Pre-filled week templates
├── grocery-list.tsx             # Generated grocery list
├── grocery-list-item.tsx        # Individual list item
└── use-meals.ts                 # Hook for meal operations

src/components/meals/contexts/
└── meal-context.tsx             # Meal plan state management

src/app/meals/
├── page.tsx                     # Meal planner page
├── library/
│   └── page.tsx                 # Meal library page
└── grocery/
    └── page.tsx                 # Grocery list page

src/app/api/meals/
├── route.ts                     # GET meals, POST create
├── [id]/
│   └── route.ts                 # GET/PATCH/DELETE meal
├── plan/
│   ├── [week]/
│   │   └── route.ts             # GET week plan
│   └── route.ts                 # POST/PATCH week plan
├── library/
│   └── route.ts                 # GET saved meals
└── grocery-list/
    ├── route.ts                 # GET/POST grocery list
    └── [id]/
        └── route.ts             # PATCH/DELETE list item
```

### 2. Data Models

```typescript
// Meal planning types
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface Meal {
  id: string;
  userId: string; // Account owner
  profileId?: string; // Optional: assigned to profile
  name: string;
  type: MealType;
  servings: number;
  notes?: string;
  recipeId?: string; // Link to recipe (if available)
  createdAt: Date;
  updatedAt: Date;

  // Relations
  plannedMeals: PlannedMeal[];
  ingredients: MealIngredient[];
  recipe?: Recipe;
}

interface PlannedMeal {
  id: string;
  userId: string;
  mealId: string;
  weekStart: Date; // Monday of the week
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  createdAt: Date;

  meal: Meal;
}

interface MealIngredient {
  id: string;
  mealId: string;
  name: string;
  quantity: string; // e.g., "1 lb", "2 cups"
  category: string; // e.g., "produce", "dairy", "protein"
  order: number;

  meal: Meal;
}

interface GroceryList {
  id: string;
  userId: string;
  weekStart: Date; // Week this list is for
  name: string;
  createdAt: Date;
  updatedAt: Date;

  items: GroceryListItem[];
}

interface GroceryListItem {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  category: string;
  isChecked: boolean;
  mealId?: string; // Link back to meal (if auto-generated)
  order: number;
  createdAt: Date;

  list: GroceryList;
}

interface SavedMeal {
  id: string;
  userId: string;
  name: string;
  type: MealType;
  servings: number;
  recipeId?: string;
  isFavorite: boolean;
  useCount: number; // Track popularity
  lastUsed: Date;
  createdAt: Date;

  ingredients: MealIngredient[];
}

interface MealTemplate {
  id: string;
  name: string; // e.g., "Meatless Monday", "Quick Weeknight Dinners"
  description: string;
  meals: TemplateMeal[]; // 28 meals (7 days x 4 meal types)
  isPublic: boolean; // System templates vs user-created
  createdBy?: string; // userId if user-created
  createdAt: Date;
}

interface TemplateMeal {
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  mealName: string;
  servings: number;
  notes?: string;
}

interface WeekPlan {
  weekStart: Date;
  meals: PlannedMeal[];
  groceryListId?: string;
}
```

### 3. Database Schema

```prisma
// Add to schema.prisma

enum MealType {
  breakfast
  lunch
  dinner
  snack
}

enum DayOfWeek {
  monday
  tuesday
  wednesday
  thursday
  friday
  saturday
  sunday
}

model Meal {
  id         String   @id @default(cuid())
  userId     String
  profileId  String?  // Optional assignment to profile
  name       String
  type       MealType
  servings   Int      @default(4)
  notes      String?  @db.Text
  recipeId   String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  profile       Profile?          @relation(fields: [profileId], references: [id])
  plannedMeals  PlannedMeal[]
  ingredients   MealIngredient[]
  recipe        Recipe?           @relation(fields: [recipeId], references: [id])

  @@index([userId, type])
}

model PlannedMeal {
  id        String    @id @default(cuid())
  userId    String
  mealId    String
  weekStart DateTime  // Monday of the week
  dayOfWeek DayOfWeek
  mealType  MealType
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  meal Meal @relation(fields: [mealId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart, dayOfWeek, mealType])
  @@index([userId, weekStart])
}

model MealIngredient {
  id       String @id @default(cuid())
  mealId   String
  name     String
  quantity String
  category String @default("other")
  order    Int    @default(0)

  meal Meal @relation(fields: [mealId], references: [id], onDelete: Cascade)

  @@index([mealId])
}

model GroceryList {
  id        String   @id @default(cuid())
  userId    String
  weekStart DateTime
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  items GroceryListItem[]

  @@index([userId, weekStart])
}

model GroceryListItem {
  id        String   @id @default(cuid())
  listId    String
  name      String
  quantity  String
  category  String   @default("other")
  isChecked Boolean  @default(false)
  mealId    String?
  order     Int      @default(0)
  createdAt DateTime @default(now())

  list GroceryList @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@index([listId, category])
}

model SavedMeal {
  id         String   @id @default(cuid())
  userId     String
  name       String
  type       MealType
  servings   Int      @default(4)
  recipeId   String?
  isFavorite Boolean  @default(false)
  useCount   Int      @default(0)
  lastUsed   DateTime @default(now())
  createdAt  DateTime @default(now())

  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  ingredients MealIngredient[]  @relation("SavedMealIngredients")

  @@index([userId, isFavorite])
  @@index([userId, lastUsed])
}

model MealTemplate {
  id          String @id @default(cuid())
  name        String
  description String @db.Text
  meals       Json   // Array of TemplateMeal
  isPublic    Boolean @default(false)
  createdBy   String?
  createdAt   DateTime @default(now())

  user User? @relation(fields: [createdBy], references: [id])

  @@index([isPublic])
}
```

### 4. Meal Context

```tsx
// src/components/meals/contexts/meal-context.tsx
"use client";

import { logger } from "@/lib/logger";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";

interface MealContextValue {
  currentWeek: Date;
  weekPlan: WeekPlan | null;
  groceryList: GroceryList | null;
  setWeek: (weekStart: Date) => void;
  refreshWeekPlan: () => Promise<void>;
  addMeal: (meal: Partial<Meal>, day: DayOfWeek, type: MealType) => Promise<void>;
  removeMeal: (plannedMealId: string) => Promise<void>;
  updateMeal: (mealId: string, updates: Partial<Meal>) => Promise<void>;
  generateGroceryList: () => Promise<void>;
}

const MealContext = createContext<MealContextValue | null>(null);

export function MealProvider({ children }: { children: ReactNode }) {
  const [currentWeek, setCurrentWeek] = useState<Date>(getMonday(new Date()));
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);

  const refreshWeekPlan = async () => {
    try {
      const weekStart = formatDateISO(currentWeek);
      const response = await fetch(`/api/meals/plan/${weekStart}`);
      if (response.ok) {
        const plan = await response.json();
        setWeekPlan(plan);
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "RefreshWeekPlanFailed",
      });
    }
  };

  const addMeal = async (meal: Partial<Meal>, day: DayOfWeek, type: MealType) => {
    try {
      const response = await fetch("/api/meals/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal,
          weekStart: formatDateISO(currentWeek),
          dayOfWeek: day,
          mealType: type,
        }),
      });

      if (response.ok) {
        await refreshWeekPlan();
        logger.event("MealAdded", {
          dayOfWeek: day,
          mealType: type,
          mealName: meal.name,
        });
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "AddMealFailed",
      });
      throw error;
    }
  };

  const removeMeal = async (plannedMealId: string) => {
    try {
      const response = await fetch(`/api/meals/plan/${plannedMealId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await refreshWeekPlan();
        logger.event("MealRemoved", { plannedMealId });
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "RemoveMealFailed",
      });
      throw error;
    }
  };

  const updateMeal = async (mealId: string, updates: Partial<Meal>) => {
    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await refreshWeekPlan();
        logger.event("MealUpdated", { mealId });
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "UpdateMealFailed",
      });
      throw error;
    }
  };

  const generateGroceryList = async () => {
    try {
      const response = await fetch("/api/meals/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: formatDateISO(currentWeek),
        }),
      });

      if (response.ok) {
        const list = await response.json();
        setGroceryList(list);
        logger.event("GroceryListGenerated", {
          weekStart: formatDateISO(currentWeek),
          itemCount: list.items.length,
        });
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "GenerateGroceryListFailed",
      });
      throw error;
    }
  };

  // Load week plan on mount and week change
  useEffect(() => {
    refreshWeekPlan();
  }, [currentWeek]);

  const setWeek = (weekStart: Date) => {
    setCurrentWeek(getMonday(weekStart));
  };

  return (
    <MealContext.Provider
      value={{
        currentWeek,
        weekPlan,
        groceryList,
        setWeek,
        refreshWeekPlan,
        addMeal,
        removeMeal,
        updateMeal,
        generateGroceryList,
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMeals() {
  const context = useContext(MealContext);
  if (!context) {
    throw new Error("useMeals must be used within MealProvider");
  }
  return context;
}

// Helper functions
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}
```

### 5. Meal Card Component

```tsx
// src/components/meals/meal-card.tsx
"use client";

import { useState } from "react";

interface MealCardProps {
  plannedMeal: PlannedMeal;
  onEdit: () => void;
  onDelete: () => void;
}

const MEAL_TYPE_ICONS = {
  breakfast: "🌅",
  lunch: "🌞",
  dinner: "🌙",
  snack: "🍎",
};

export function MealCard({ plannedMeal, onEdit, onDelete }: MealCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const meal = plannedMeal.meal;

  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{MEAL_TYPE_ICONS[meal.type]}</span>
            <span className="text-sm font-medium text-gray-900">{meal.name}</span>
          </div>

          {meal.servings && (
            <div className="mt-1 text-xs text-gray-500">{meal.servings} servings</div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded p-1 hover:bg-gray-100"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 hover:bg-gray-100"
          >
            🗑️
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          {meal.notes && <div className="text-xs text-gray-600">📝 {meal.notes}</div>}

          {meal.recipeId && (
            <a
              href={`/recipes/${meal.recipeId}`}
              className="block text-xs text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              📖 View Recipe
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

### 6. Meal Planner Grid Component

```tsx
// src/components/meals/meal-planner.tsx
"use client";

import { useState } from "react";
import { useMeals } from "./contexts/meal-context";
import { MealCard } from "./meal-card";
import { MealSlot } from "./meal-slot";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function MealPlanner() {
  const { currentWeek, weekPlan, setWeek, removeMeal } = useMeals();
  const [selectedSlot, setSelectedSlot] = useState<{ day: DayOfWeek; type: MealType } | null>(null);

  const goToPreviousWeek = () => {
    const prev = new Date(currentWeek);
    prev.setDate(prev.getDate() - 7);
    setWeek(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + 7);
    setWeek(next);
  };

  const getMealForSlot = (day: DayOfWeek, type: MealType): PlannedMeal | null => {
    if (!weekPlan) return null;
    return weekPlan.meals.find((m) => m.dayOfWeek === day && m.mealType === type) || null;
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Week of {formatWeekRange(currentWeek)}</h2>
        <div className="flex gap-2">
          <button
            onClick={goToPreviousWeek}
            className="rounded bg-gray-100 px-3 py-1 hover:bg-gray-200"
          >
            ◀ Prev
          </button>
          <button
            onClick={goToNextWeek}
            className="rounded bg-gray-100 px-3 py-1 hover:bg-gray-200"
          >
            Next ▶
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-20 border border-gray-300 bg-gray-50 p-2"></th>
              {DAYS.map((day) => (
                <th key={day} className="border border-gray-300 bg-gray-50 p-2">
                  {capitalize(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map((type) => (
              <tr key={type}>
                <td className="border border-gray-300 bg-gray-50 p-2 font-medium">
                  {getMealTypeIcon(type)}
                </td>
                {DAYS.map((day) => {
                  const meal = getMealForSlot(day, type);
                  return (
                    <td key={`${day}-${type}`} className="border border-gray-300 p-2">
                      {meal ? (
                        <MealCard
                          plannedMeal={meal}
                          onEdit={() => setSelectedSlot({ day, type })}
                          onDelete={() => removeMeal(meal.id)}
                        />
                      ) : (
                        <MealSlot
                          day={day}
                          type={type}
                          onAdd={() => setSelectedSlot({ day, type })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add meal modal (if slot selected) */}
      {selectedSlot && (
        <AddMealModal
          day={selectedSlot.day}
          type={selectedSlot.type}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  );
}

function getMealTypeIcon(type: MealType): string {
  const icons = {
    breakfast: "🌅 Breakfast",
    lunch: "🌞 Lunch",
    dinner: "🌙 Dinner",
    snack: "🍎 Snack",
  };
  return icons[type];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${weekStart.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}
```

### 7. API Routes (Key Examples)

```typescript
// src/app/api/meals/plan/[week]/route.ts
import { getCurrentUser, requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { week: string } }) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const weekStart = new Date(params.week);

    const plannedMeals = await prisma.plannedMeal.findMany({
      where: {
        userId: user.id,
        weekStart,
      },
      include: {
        meal: {
          include: {
            ingredients: true,
            recipe: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
    });

    const groceryList = await prisma.groceryList.findFirst({
      where: {
        userId: user.id,
        weekStart,
      },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
    });

    return NextResponse.json({
      weekStart,
      meals: plannedMeals,
      groceryListId: groceryList?.id,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/meals/plan/${params.week}`,
      method: "GET",
    });

    return NextResponse.json({ error: "Failed to fetch meal plan" }, { status: 500 });
  }
}

// src/app/api/meals/grocery-list/route.ts
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { weekStart } = await request.json();

    // Get all planned meals for the week
    const plannedMeals = await prisma.plannedMeal.findMany({
      where: {
        userId: user.id,
        weekStart: new Date(weekStart),
      },
      include: {
        meal: {
          include: {
            ingredients: true,
          },
        },
      },
    });

    // Aggregate ingredients by category
    const ingredientMap = new Map<string, { quantity: string; category: string; mealId: string }>();

    plannedMeals.forEach((pm) => {
      pm.meal.ingredients.forEach((ing) => {
        if (ingredientMap.has(ing.name)) {
          // Combine quantities (simple for now, could be smarter)
          const existing = ingredientMap.get(ing.name)!;
          existing.quantity = `${existing.quantity}, ${ing.quantity}`;
        } else {
          ingredientMap.set(ing.name, {
            quantity: ing.quantity,
            category: ing.category,
            mealId: pm.meal.id,
          });
        }
      });
    });

    // Create grocery list
    const groceryList = await prisma.groceryList.create({
      data: {
        userId: user.id,
        weekStart: new Date(weekStart),
        name: `Week of ${new Date(weekStart).toLocaleDateString()}`,
        items: {
          create: Array.from(ingredientMap.entries()).map(([name, data], index) => ({
            name,
            quantity: data.quantity,
            category: data.category,
            mealId: data.mealId,
            order: index,
            isChecked: false,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    logger.event("GroceryListGenerated", {
      userId: user.id,
      weekStart,
      itemCount: groceryList.items.length,
    });

    return NextResponse.json(groceryList, { status: 201 });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/meals/grocery-list",
      method: "POST",
    });

    return NextResponse.json({ error: "Failed to generate grocery list" }, { status: 500 });
  }
}
```

## Implementation Steps

### Phase 1: Foundation

1. Update database schema (Meal, PlannedMeal, GroceryList models)
2. Create API routes for basic CRUD operations
3. Build MealContext for state management
4. Test API routes

### Phase 2: Core UI

5. Build MealPlanner grid component
6. Create MealCard and MealSlot components
7. Implement AddMealModal
8. Test meal creation and deletion

### Phase 3: Grocery List

9. Build GroceryList component
10. Implement ingredient aggregation logic
11. Add check/uncheck functionality
12. Test grocery list generation

### Phase 4: Meal Library

13. Create SavedMeal functionality
14. Build MealLibrary component
15. Implement quick-add from library
16. Track meal usage count

### Phase 5: Advanced Features

17. Add meal templates
18. Implement drag-and-drop (react-beautiful-dnd)
19. Add recipe integration
20. Implement copy week functionality

### Phase 6: Polish

21. Add loading states and error handling
22. Improve mobile responsiveness
23. Add accessibility features
24. Performance optimization

## Challenges and Considerations

### Challenge 1: Ingredient Aggregation

- **Problem**: Combining ingredients from multiple meals
- **Solution**: Use Map to aggregate by ingredient name, combine quantities

### Challenge 2: Drag and Drop

- **Problem**: Moving meals between slots
- **Solution**: Use react-beautiful-dnd or @dnd-kit for drag-and-drop

### Challenge 3: Mobile Layout

- **Problem**: Grid doesn't fit on mobile screens
- **Solution**: Responsive design - stack days vertically on mobile

### Challenge 4: Recipe Integration

- **Problem**: Linking recipes to meals
- **Solution**: Use existing Recipe model, add foreign key

## Testing Strategy

1. **Unit Tests**: API routes, ingredient aggregation
2. **Component Tests**: MealCard, MealPlanner, GroceryList
3. **E2E Tests**: Complete meal planning flow
4. **Manual Tests**: Drag-and-drop, mobile responsiveness

## Future Enhancements

- Meal prep reminders
- Nutrition tracking
- Recipe suggestions based on pantry
- Shopping list integration with grocery delivery services
- Voice input for meals (Alexa/Google Assistant)
- Meal photos and ratings
- Leftovers tracking

## Dependencies

- Prisma (database)
- react-beautiful-dnd or @dnd-kit (drag-and-drop)
- date-fns (date manipulation)

## Integration with Other Features

- **Multi-Profile Support**: Assign meals to profiles
- **Recipe Display**: Link recipes to meals
- **Google Tasks**: Create tasks from meal prep reminders
- **Calendar**: Show meal times on calendar

---

This meal planning feature brings structure to family meals, reduces decision fatigue, and streamlines grocery shopping - making it a valuable complement to the task and calendar features.
