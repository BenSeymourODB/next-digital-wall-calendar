import type { Recipe } from "@/components/recipe/types";

/**
 * Sample recipes for testing the recipe display component.
 */

export const chocolateChipCookies: Recipe = {
  id: "chocolate-chip-cookies",
  name: "Chocolate Chip Cookies",
  description:
    "Classic homemade chocolate chip cookies that are crispy on the outside and chewy on the inside.",
  servings: 24,
  prepTime: 15,
  cookTime: 12,
  ingredients: [
    { id: "flour", quantity: "2 1/4 cups", item: "all-purpose flour" },
    { id: "baking-soda", quantity: "1 tsp", item: "baking soda" },
    { id: "salt", quantity: "1 tsp", item: "salt" },
    { id: "butter", quantity: "1 cup", item: "butter", notes: "softened" },
    { id: "sugar", quantity: "3/4 cup", item: "granulated sugar" },
    { id: "brown-sugar", quantity: "3/4 cup", item: "packed brown sugar" },
    { id: "vanilla", quantity: "1 tsp", item: "vanilla extract" },
    { id: "eggs", quantity: "2 large", item: "eggs" },
    { id: "chocolate-chips", quantity: "2 cups", item: "chocolate chips" },
    {
      id: "walnuts",
      quantity: "1 cup",
      item: "chopped walnuts",
      notes: "optional",
    },
  ],
  steps: [
    {
      id: "step-1",
      stepNumber: 1,
      instruction: "Preheat oven to 375°F (190°C).",
      duration: 10,
    },
    {
      id: "step-2",
      stepNumber: 2,
      instruction: "Combine flour, baking soda and salt in a small bowl.",
    },
    {
      id: "step-3",
      stepNumber: 3,
      instruction:
        "Beat butter, granulated sugar, brown sugar and vanilla extract in large mixer bowl until creamy.",
      duration: 3,
    },
    {
      id: "step-4",
      stepNumber: 4,
      instruction: "Add eggs, one at a time, beating well after each addition.",
    },
    {
      id: "step-5",
      stepNumber: 5,
      instruction:
        "Gradually beat in flour mixture until just combined. Don't overmix.",
    },
    {
      id: "step-6",
      stepNumber: 6,
      instruction: "Stir in chocolate chips and walnuts (if using) by hand.",
    },
    {
      id: "step-7",
      stepNumber: 7,
      instruction:
        "Drop rounded tablespoon of dough onto ungreased baking sheets, spacing them about 2 inches apart.",
    },
    {
      id: "step-8",
      stepNumber: 8,
      instruction:
        "Bake for 9 to 11 minutes or until golden brown. Cookies will appear slightly underdone.",
      duration: 11,
    },
    {
      id: "step-9",
      stepNumber: 9,
      instruction:
        "Cool on baking sheets for 2 minutes, then remove to wire racks to cool completely.",
      duration: 5,
    },
  ],
};

export const spaghettiCarbonara: Recipe = {
  id: "spaghetti-carbonara",
  name: "Spaghetti Carbonara",
  description:
    "A classic Italian pasta dish made with eggs, cheese, pancetta, and black pepper.",
  servings: 4,
  prepTime: 10,
  cookTime: 20,
  ingredients: [
    { id: "spaghetti", quantity: "400g", item: "spaghetti" },
    {
      id: "pancetta",
      quantity: "200g",
      item: "pancetta or guanciale",
      notes: "diced",
    },
    { id: "eggs", quantity: "4", item: "large eggs" },
    { id: "yolks", quantity: "2", item: "egg yolks" },
    {
      id: "pecorino",
      quantity: "100g",
      item: "Pecorino Romano",
      notes: "finely grated",
    },
    {
      id: "parmesan",
      quantity: "50g",
      item: "Parmesan cheese",
      notes: "finely grated",
    },
    { id: "pepper", quantity: "2 tsp", item: "freshly ground black pepper" },
    { id: "salt", item: "salt", notes: "for pasta water" },
  ],
  steps: [
    {
      id: "step-1",
      stepNumber: 1,
      instruction:
        "Bring a large pot of salted water to a boil. Add the spaghetti and cook until al dente according to package directions.",
      duration: 10,
    },
    {
      id: "step-2",
      stepNumber: 2,
      instruction:
        "While pasta cooks, beat the whole eggs and egg yolks together in a bowl. Add most of the grated cheeses (save some for serving), and the black pepper. Mix well.",
    },
    {
      id: "step-3",
      stepNumber: 3,
      instruction:
        "Place the pancetta in a large cold skillet. Cook over medium heat until the fat renders and the pancetta is crispy, about 8-10 minutes.",
      duration: 10,
    },
    {
      id: "step-4",
      stepNumber: 4,
      instruction:
        "Remove the skillet from heat. Reserve 1 cup of pasta cooking water before draining the pasta.",
    },
    {
      id: "step-5",
      stepNumber: 5,
      instruction:
        "Add the hot drained pasta to the skillet with the pancetta. Toss to combine and coat the pasta in the rendered fat.",
    },
    {
      id: "step-6",
      stepNumber: 6,
      instruction:
        "Working quickly off the heat, pour the egg and cheese mixture over the pasta. Toss vigorously to coat - the residual heat will cook the eggs into a creamy sauce. Add pasta water a splash at a time if needed to loosen.",
    },
    {
      id: "step-7",
      stepNumber: 7,
      instruction:
        "Serve immediately with extra cheese and freshly ground black pepper on top.",
    },
  ],
};

export const bananaBread: Recipe = {
  id: "banana-bread",
  name: "Classic Banana Bread",
  description:
    "Moist and delicious banana bread, perfect for using up overripe bananas.",
  servings: 10,
  prepTime: 15,
  cookTime: 60,
  ingredients: [
    { id: "bananas", quantity: "3", item: "ripe bananas", notes: "mashed" },
    { id: "sugar", quantity: "1 cup", item: "sugar" },
    { id: "egg", quantity: "1", item: "egg", notes: "beaten" },
    { id: "butter", quantity: "1/4 cup", item: "butter", notes: "melted" },
    { id: "flour", quantity: "1 1/2 cups", item: "all-purpose flour" },
    { id: "baking-soda", quantity: "1 tsp", item: "baking soda" },
    { id: "salt", quantity: "1/4 tsp", item: "salt" },
  ],
  steps: [
    {
      id: "step-1",
      stepNumber: 1,
      instruction: "Preheat oven to 325°F (165°C). Grease a 9x5 inch loaf pan.",
      duration: 5,
    },
    {
      id: "step-2",
      stepNumber: 2,
      instruction:
        "In a large bowl, mash the bananas with a fork until smooth.",
    },
    {
      id: "step-3",
      stepNumber: 3,
      instruction:
        "Mix in the sugar, beaten egg, and melted butter until well combined.",
    },
    {
      id: "step-4",
      stepNumber: 4,
      instruction:
        "In a separate bowl, whisk together the flour, baking soda, and salt.",
    },
    {
      id: "step-5",
      stepNumber: 5,
      instruction:
        "Add the dry ingredients to the banana mixture. Stir until just combined - do not overmix.",
    },
    {
      id: "step-6",
      stepNumber: 6,
      instruction: "Pour the batter into the prepared loaf pan.",
    },
    {
      id: "step-7",
      stepNumber: 7,
      instruction:
        "Bake for 60 to 65 minutes, until a toothpick inserted into the center comes out clean.",
      duration: 65,
    },
    {
      id: "step-8",
      stepNumber: 8,
      instruction:
        "Let cool in pan for 10 minutes, then remove to a wire rack to cool completely.",
      duration: 10,
    },
  ],
};

/**
 * All sample recipes
 */
export const sampleRecipes: Recipe[] = [
  chocolateChipCookies,
  spaghettiCarbonara,
  bananaBread,
];

/**
 * Get a recipe by ID
 */
export function getRecipeById(id: string): Recipe | undefined {
  return sampleRecipes.find((recipe) => recipe.id === id);
}
