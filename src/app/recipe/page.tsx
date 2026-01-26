"use client";

import { RecipeDisplay } from "@/components/recipe";
import { Button } from "@/components/ui/button";
import { getRecipeById, sampleRecipes } from "@/lib/recipe/sample-recipes";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function RecipePage() {
  const [selectedRecipeId, setSelectedRecipeId] = useState(sampleRecipes[0].id);
  const selectedRecipe = getRecipeById(selectedRecipeId) ?? sampleRecipes[0];

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <h1 className="text-lg font-semibold text-gray-900">
            Recipe Display
          </h1>

          {/* Recipe selector */}
          <select
            value={selectedRecipeId}
            onChange={(e) => setSelectedRecipeId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            {sampleRecipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4">
        <div className="mx-auto h-[calc(100vh-8rem)] max-w-4xl">
          <RecipeDisplay recipe={selectedRecipe} initialZoom={1.0} />
        </div>
      </main>

      {/* Footer with instructions */}
      <footer className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-4xl text-center text-sm text-gray-500">
          <p>
            <strong>Controls:</strong> Use arrow keys (← →) to navigate pages |
            Use +/- or Ctrl+scroll to zoom | Pinch to zoom on touch devices
          </p>
        </div>
      </footer>
    </div>
  );
}
