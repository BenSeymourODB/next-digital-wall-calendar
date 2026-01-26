/**
 * Recipe Display Component Types
 *
 * Types for the zoom-based paginated recipe display component.
 */

/**
 * A single ingredient in a recipe
 */
export interface Ingredient {
  id: string;
  /** Quantity with unit, e.g., "2 cups", "1 tsp" */
  quantity?: string;
  /** The ingredient name, e.g., "all-purpose flour" */
  item: string;
  /** Optional preparation notes, e.g., "sifted", "room temperature" */
  notes?: string;
}

/**
 * A single step in a recipe
 */
export interface RecipeStep {
  id: string;
  /** 1-indexed step number */
  stepNumber: number;
  /** The instruction text */
  instruction: string;
  /** Optional duration in minutes */
  duration?: number;
  /** Optional image URL for the step */
  image?: string;
}

/**
 * A complete recipe
 */
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  /** Number of servings, e.g., 24 for "Makes 24 cookies" */
  servings?: number;
  /** Prep time in minutes */
  prepTime?: number;
  /** Cook time in minutes */
  cookTime?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

/**
 * A zoom level configuration
 */
export interface ZoomLevel {
  /** Scale factor, e.g., 1.0 = 100%, 1.5 = 150% */
  scale: number;
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
}

/**
 * A page of content in the paginated recipe display
 */
export interface Page {
  pageNumber: number;
  type: "ingredients" | "steps";
  items: Ingredient[] | RecipeStep[];
  startIndex: number;
  endIndex: number;
}

/**
 * State of the pagination system
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  itemsOnCurrentPage: number;
  pages: Page[];
}
