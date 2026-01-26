"use client";

import type { Ingredient, Page, RecipeStep, ZoomLevel } from "./types";

interface RecipeContentProps {
  /** The current page to render */
  page: Page | null;
  /** Current zoom level for styling */
  zoomLevel: ZoomLevel;
}

/**
 * Renders the content for a single page of the recipe.
 * Displays either ingredients or steps based on the page type.
 */
export function RecipeContent({ page, zoomLevel }: RecipeContentProps) {
  const contentStyle = {
    fontSize: `${zoomLevel.fontSize}px`,
    lineHeight: zoomLevel.lineHeight,
  };

  if (!page) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-gray-500">
        No content to display
      </div>
    );
  }

  if (page.items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-gray-500">
        {page.type === "ingredients" ? "No ingredients" : "No steps"}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden p-6" style={contentStyle}>
      {page.type === "ingredients" ? (
        <IngredientsContent items={page.items as Ingredient[]} />
      ) : (
        <StepsContent items={page.items as RecipeStep[]} />
      )}
    </div>
  );
}

interface IngredientsContentProps {
  items: Ingredient[];
}

function IngredientsContent({ items }: IngredientsContentProps) {
  return (
    <div>
      <h3 className="mb-4 font-semibold text-gray-900">Ingredients:</h3>
      <ul className="space-y-2">
        {items.map((ingredient) => (
          <li key={ingredient.id} className="flex gap-2">
            <span className="text-gray-400">&#x2022;</span>
            <span>
              {ingredient.quantity && (
                <span className="font-medium">{ingredient.quantity} </span>
              )}
              <span className="text-gray-900">{ingredient.item}</span>
              {ingredient.notes && (
                <span className="text-gray-600"> ({ingredient.notes})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StepsContentProps {
  items: RecipeStep[];
}

function StepsContent({ items }: StepsContentProps) {
  return (
    <div>
      <h3 className="mb-4 font-semibold text-gray-900">Steps:</h3>
      <div className="space-y-4">
        {items.map((step) => (
          <div key={step.id} className="flex gap-3">
            <span className="flex-shrink-0 font-semibold text-blue-600">
              {step.stepNumber}.
            </span>
            <div>
              <p className="text-gray-900">{step.instruction}</p>
              {step.duration && (
                <p className="mt-1 text-sm text-gray-600">
                  ~{step.duration} minute{step.duration !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
