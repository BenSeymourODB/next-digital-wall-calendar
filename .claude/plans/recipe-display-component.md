# Recipe Display Component with Zoom-Based Pagination

## Overview
Create a recipe display component that shows ingredients and cooking steps with dynamic pagination controlled by zoom level. As users zoom in/out, the number of items displayed per page adjusts automatically based on what fits in the viewable area.

## Requirements

### Core Features

#### 1. Recipe Data Structure
- **Ingredients List**: Array of ingredient items with quantities
- **Steps**: Numbered cooking instructions
- **Metadata**: Recipe name, servings, prep/cook time (optional)

#### 2. Display Modes
- **Ingredients Mode**: Show ingredient list
- **Steps Mode**: Show cooking steps
- **Combined Mode**: Option to show both (TBD)

#### 3. Pagination
- **Navigation Controls**: Forward/back arrow buttons at bottom
- **Page Indicator**: Show current page and total pages (e.g., "Step 2 of 5")
- **Dynamic Page Breaks**: Pages adjust based on zoom level

#### 4. Zoom Interaction
- **Zoom Methods**:
  - Pinch-to-zoom on touch devices
  - Ctrl + scroll wheel on desktop
  - Zoom buttons (+/- controls)
- **Text Scaling**: Text size increases/decreases with zoom
- **Smart Pagination**:
  - Zooming in: Fewer items per page (e.g., 3 steps → 1 step)
  - Zooming out: More items per page (e.g., 1 step → 3 steps)
  - Recalculate pages when zoom changes
- **Item Integrity**: Only show complete items (never cut off mid-item)

#### 5. Memory Management
- **All Content Loaded**: Keep all steps/ingredients in memory
- **Render Visible Only**: Only render current page in DOM
- **Fast Transitions**: Instant page switching when zooming

### Visual Design

```
┌─────────────────────────────────────┐
│  Chocolate Chip Cookies      [−] [+]│  ← Recipe name and zoom controls
│  Makes 24 cookies                   │
├─────────────────────────────────────┤
│                                     │
│  Ingredients:                       │
│                                     │
│  • 2 cups all-purpose flour        │
│  • 1 tsp baking soda               │
│  • 1/2 tsp salt                    │
│  • 1 cup butter, softened          │
│  • 3/4 cup sugar                   │
│  • 3/4 cup brown sugar             │
│  • 2 large eggs                    │
│  • 2 tsp vanilla extract           │
│  • 2 cups chocolate chips          │
│                                     │
│                                     │
│           [←]  1 / 2  [→]          │  ← Navigation controls
└─────────────────────────────────────┘

After zooming in (fewer items per page):

┌─────────────────────────────────────┐
│  Chocolate Chip Cookies      [−] [+]│
│  Makes 24 cookies                   │
├─────────────────────────────────────┤
│                                     │
│  Ingredients:                       │
│                                     │
│  • 2 cups all-purpose flour        │
│                                     │
│  • 1 tsp baking soda               │
│                                     │
│  • 1/2 tsp salt                    │
│                                     │
│                                     │
│                                     │
│           [←]  1 / 4  [→]          │
└─────────────────────────────────────┘
```

### Zoom Behavior Example

**Zoom Level 1 (Default - 100%)**
- Text size: 18px
- Ingredients per page: ~9 items
- Steps per page: ~3 steps
- Total pages: 2 (ingredients) + 5 (steps) = 7 pages

**Zoom Level 2 (150%)**
- Text size: 27px
- Ingredients per page: ~6 items
- Steps per page: ~2 steps
- Total pages: 2 (ingredients) + 7 (steps) = 9 pages

**Zoom Level 3 (200%)**
- Text size: 36px
- Ingredients per page: ~3 items
- Steps per page: ~1 step
- Total pages: 3 (ingredients) + 12 (steps) = 15 pages

## Technical Implementation Plan

### 1. Component Structure

```
src/components/recipe/
├── recipe-display.tsx         # Main component
├── recipe-content.tsx         # Content renderer
├── recipe-navigation.tsx      # Nav controls (arrows, page indicator)
├── zoom-controls.tsx          # Zoom in/out buttons
├── use-recipe-pagination.ts   # Pagination logic hook
├── use-zoom.ts                # Zoom level management hook
└── types.ts                   # TypeScript types

src/lib/recipe/
├── recipe-loader.ts           # Load recipe data
└── pagination-calculator.ts   # Calculate items per page
```

### 2. Data Models

```typescript
interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings?: number;
  prepTime?: number;        // minutes
  cookTime?: number;        // minutes
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

interface Ingredient {
  id: string;
  quantity?: string;        // "2 cups", "1 tsp", etc.
  item: string;            // "all-purpose flour"
  notes?: string;          // "sifted", "room temperature"
}

interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  duration?: number;       // minutes (optional)
  image?: string;          // optional step image
}

interface ZoomLevel {
  scale: number;           // 1.0 = 100%, 1.5 = 150%, etc.
  fontSize: number;        // px
  lineHeight: number;      // multiplier
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  itemsOnCurrentPage: number;
  pages: Page[];
}

interface Page {
  pageNumber: number;
  type: 'ingredients' | 'steps';
  items: (Ingredient | RecipeStep)[];
  startIndex: number;
  endIndex: number;
}
```

### 3. RecipeDisplay Component

```tsx
// src/components/recipe/recipe-display.tsx
interface RecipeDisplayProps {
  recipe: Recipe;
  initialZoom?: number;
  className?: string;
}

export function RecipeDisplay({
  recipe,
  initialZoom = 1.0,
  className,
}: RecipeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoomLevel, zoomIn, zoomOut, setZoom } = useZoom(initialZoom);
  const {
    currentPage,
    totalPages,
    currentPageItems,
    nextPage,
    previousPage,
    goToPage,
  } = useRecipePagination({
    recipe,
    zoomLevel,
    containerHeight: containerRef.current?.clientHeight || 600,
  });

  // Handle pinch-to-zoom
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let initialDistance = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches[0], e.touches[1]);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const delta = currentDistance - initialDistance;

        if (Math.abs(delta) > 10) {
          const zoomDelta = delta > 0 ? 0.1 : -0.1;
          setZoom(Math.max(0.5, Math.min(3.0, zoomLevel.scale + zoomDelta)));
          initialDistance = currentDistance;
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [zoomLevel.scale, setZoom]);

  // Handle Ctrl+Scroll zoom
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(Math.max(0.5, Math.min(3.0, zoomLevel.scale + delta)));
      }
    };

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel.scale, setZoom]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') previousPage();
      if (e.key === 'ArrowRight') nextPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, previousPage]);

  return (
    <div
      ref={containerRef}
      className={`bg-white rounded-lg shadow-md flex flex-col ${className}`}
      style={{ height: '100%' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{recipe.name}</h2>
          {recipe.servings && (
            <p className="text-sm text-gray-600">Makes {recipe.servings} servings</p>
          )}
        </div>

        <ZoomControls
          zoomLevel={zoomLevel.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <RecipeContent
          page={currentPageItems}
          zoomLevel={zoomLevel}
        />
      </div>

      {/* Navigation */}
      <RecipeNavigation
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevious={previousPage}
        onNext={nextPage}
      />
    </div>
  );
}

function getDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
```

### 4. useRecipePagination Hook

```typescript
// src/components/recipe/use-recipe-pagination.ts
interface UseRecipePaginationProps {
  recipe: Recipe;
  zoomLevel: ZoomLevel;
  containerHeight: number;
}

function useRecipePagination({
  recipe,
  zoomLevel,
  containerHeight,
}: UseRecipePaginationProps) {
  const [currentPage, setCurrentPage] = useState(0);

  // Calculate pagination based on zoom and container height
  const pagination = useMemo(() => {
    return calculatePagination(recipe, zoomLevel, containerHeight);
  }, [recipe, zoomLevel, containerHeight]);

  // Ensure current page is valid after recalculation
  useEffect(() => {
    if (currentPage >= pagination.totalPages) {
      setCurrentPage(Math.max(0, pagination.totalPages - 1));
    }
  }, [currentPage, pagination.totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages - 1));
  }, [pagination.totalPages]);

  const previousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(0, Math.min(page, pagination.totalPages - 1)));
    },
    [pagination.totalPages]
  );

  return {
    currentPage,
    totalPages: pagination.totalPages,
    currentPageItems: pagination.pages[currentPage],
    nextPage,
    previousPage,
    goToPage,
  };
}

function calculatePagination(
  recipe: Recipe,
  zoomLevel: ZoomLevel,
  containerHeight: number
): PaginationState {
  const pages: Page[] = [];

  // Calculate available height for content (excluding header/footer)
  const availableHeight = containerHeight - 200; // Subtract header/nav height

  // Calculate item heights at current zoom
  const ingredientHeight = calculateItemHeight(
    'ingredient',
    zoomLevel.fontSize,
    zoomLevel.lineHeight
  );
  const stepHeight = calculateItemHeight(
    'step',
    zoomLevel.fontSize,
    zoomLevel.lineHeight
  );

  // Calculate items per page
  const ingredientsPerPage = Math.floor(availableHeight / ingredientHeight);
  const stepsPerPage = Math.floor(availableHeight / stepHeight);

  // Create ingredient pages
  for (let i = 0; i < recipe.ingredients.length; i += ingredientsPerPage) {
    pages.push({
      pageNumber: pages.length,
      type: 'ingredients',
      items: recipe.ingredients.slice(i, i + ingredientsPerPage),
      startIndex: i,
      endIndex: Math.min(i + ingredientsPerPage, recipe.ingredients.length),
    });
  }

  // Create step pages
  for (let i = 0; i < recipe.steps.length; i += stepsPerPage) {
    pages.push({
      pageNumber: pages.length,
      type: 'steps',
      items: recipe.steps.slice(i, i + stepsPerPage),
      startIndex: i,
      endIndex: Math.min(i + stepsPerPage, recipe.steps.length),
    });
  }

  return {
    currentPage: 0,
    totalPages: pages.length,
    itemsOnCurrentPage: pages[0]?.items.length || 0,
    pages,
  };
}

function calculateItemHeight(
  type: 'ingredient' | 'step',
  fontSize: number,
  lineHeight: number
): number {
  // Estimate based on average content length
  if (type === 'ingredient') {
    // Ingredients are typically 1-2 lines
    const averageLines = 1.5;
    return fontSize * lineHeight * averageLines + 16; // +16 for padding
  } else {
    // Steps are typically 2-4 lines
    const averageLines = 3;
    return fontSize * lineHeight * averageLines + 24; // +24 for padding and spacing
  }
}
```

### 5. useZoom Hook

```typescript
// src/components/recipe/use-zoom.ts
const ZOOM_LEVELS: ZoomLevel[] = [
  { scale: 0.75, fontSize: 14, lineHeight: 1.5 },
  { scale: 1.0, fontSize: 18, lineHeight: 1.6 },
  { scale: 1.25, fontSize: 22, lineHeight: 1.6 },
  { scale: 1.5, fontSize: 27, lineHeight: 1.7 },
  { scale: 1.75, fontSize: 31, lineHeight: 1.7 },
  { scale: 2.0, fontSize: 36, lineHeight: 1.8 },
  { scale: 2.5, fontSize: 45, lineHeight: 1.8 },
  { scale: 3.0, fontSize: 54, lineHeight: 1.9 },
];

function useZoom(initialScale: number = 1.0) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    return ZOOM_LEVELS.findIndex((z) => z.scale === initialScale) || 1;
  });

  const zoomIn = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const setZoom = useCallback((scale: number) => {
    // Find closest zoom level
    const closest = ZOOM_LEVELS.reduce((prev, curr) =>
      Math.abs(curr.scale - scale) < Math.abs(prev.scale - scale) ? curr : prev
    );
    const index = ZOOM_LEVELS.findIndex((z) => z.scale === closest.scale);
    setCurrentIndex(index);
  }, []);

  return {
    zoomLevel: ZOOM_LEVELS[currentIndex],
    zoomIn,
    zoomOut,
    setZoom,
  };
}
```

### 6. RecipeContent Component

```tsx
// src/components/recipe/recipe-content.tsx
interface RecipeContentProps {
  page: Page;
  zoomLevel: ZoomLevel;
}

export function RecipeContent({ page, zoomLevel }: RecipeContentProps) {
  const contentStyle = {
    fontSize: `${zoomLevel.fontSize}px`,
    lineHeight: zoomLevel.lineHeight,
  };

  if (!page) return null;

  return (
    <div
      className="p-6 h-full overflow-hidden"
      style={contentStyle}
    >
      {page.type === 'ingredients' ? (
        <div>
          <h3 className="font-semibold mb-4 text-gray-900">Ingredients:</h3>
          <ul className="space-y-2">
            {(page.items as Ingredient[]).map((ingredient) => (
              <li key={ingredient.id} className="flex gap-2">
                <span>•</span>
                <span>
                  {ingredient.quantity && (
                    <span className="font-medium">{ingredient.quantity} </span>
                  )}
                  {ingredient.item}
                  {ingredient.notes && (
                    <span className="text-gray-600"> ({ingredient.notes})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <h3 className="font-semibold mb-4 text-gray-900">Steps:</h3>
          <div className="space-y-4">
            {(page.items as RecipeStep[]).map((step) => (
              <div key={step.id} className="flex gap-3">
                <span className="font-semibold text-blue-600 flex-shrink-0">
                  {step.stepNumber}.
                </span>
                <div>
                  <p className="text-gray-900">{step.instruction}</p>
                  {step.duration && (
                    <p className="text-sm text-gray-600 mt-1">
                      ~{step.duration} minutes
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 7. Navigation and Zoom Controls

```tsx
// src/components/recipe/recipe-navigation.tsx
interface RecipeNavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function RecipeNavigation({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}: RecipeNavigationProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-4 border-t">
      <button
        onClick={onPrevious}
        disabled={currentPage === 0}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        ←
      </button>

      <span className="text-gray-700">
        {currentPage + 1} / {totalPages}
      </span>

      <button
        onClick={onNext}
        disabled={currentPage === totalPages - 1}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        →
      </button>
    </div>
  );
}

// src/components/recipe/zoom-controls.tsx
interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
}: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onZoomOut}
        className="p-2 rounded hover:bg-gray-100"
        aria-label="Zoom out"
      >
        −
      </button>

      <span className="text-sm text-gray-600 w-12 text-center">
        {Math.round(zoomLevel * 100)}%
      </span>

      <button
        onClick={onZoomIn}
        className="p-2 rounded hover:bg-gray-100"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
```

## Implementation Steps

1. **Create data models and types**
   - Define Recipe, Ingredient, RecipeStep interfaces
   - Create sample recipe data for testing

2. **Implement useZoom hook**
   - Define zoom levels
   - Create zoom in/out/set functions
   - Test zoom level transitions

3. **Create basic RecipeContent component**
   - Render ingredients and steps
   - Apply zoom-based styling
   - Test with mock data

4. **Implement useRecipePagination hook**
   - Calculate items per page based on zoom
   - Create pagination state
   - Test pagination calculation

5. **Build RecipeDisplay component**
   - Integrate all sub-components
   - Add pinch-to-zoom support
   - Add Ctrl+scroll zoom support
   - Test zoom interactions

6. **Add navigation controls**
   - Create RecipeNavigation component
   - Wire up previous/next handlers
   - Add keyboard support (arrow keys)

7. **Add zoom controls**
   - Create ZoomControls component
   - Wire up zoom in/out buttons
   - Display current zoom level

8. **Optimize pagination transitions**
   - Ensure smooth page transitions when zooming
   - Handle edge cases (last page, empty pages)
   - Test rapid zoom changes

9. **Polish and accessibility**
   - Add ARIA labels
   - Ensure keyboard navigation works
   - Test with screen readers
   - Add loading states for recipe data

10. **Integration and testing**
    - Test with various recipe sizes
    - Test on different screen sizes
    - Test touch interactions on mobile
    - Performance testing

## Challenges and Considerations

### Challenge 1: Dynamic Height Calculation
- **Problem**: Need to accurately calculate how many items fit per page
- **Solution**:
  - Use estimated heights based on average content
  - Adjust if items overflow
  - Allow some margin for error

### Challenge 2: Zoom Transition Smoothness
- **Problem**: Pagination recalculation may cause jarring page jumps
- **Solution**:
  - Try to maintain current item in view after zoom
  - Smooth transition between pages
  - Debounce rapid zoom changes

### Challenge 3: Touch vs Mouse Interactions
- **Problem**: Different zoom mechanisms for touch and mouse
- **Solution**:
  - Detect input type
  - Pinch-to-zoom for touch
  - Ctrl+scroll for mouse
  - Zoom buttons work for both

### Challenge 4: Variable Content Length
- **Problem**: Steps vary greatly in length (1 line vs 5 lines)
- **Solution**:
  - Use average height for calculations
  - Accept some variance in items per page
  - Ensure no item is cut off mid-content

### Challenge 5: Memory with Large Recipes
- **Problem**: Very long recipes (50+ steps) may use too much memory
- **Solution**:
  - For phase 1: Load all in memory (most recipes are <20 steps)
  - For phase 2: Implement virtual scrolling if needed
  - Monitor performance

## Testing Strategy

1. **Unit Tests**:
   - Pagination calculation logic
   - Zoom level transitions
   - Item height estimation

2. **Component Tests**:
   - RecipeContent rendering
   - Navigation controls
   - Zoom controls

3. **Integration Tests**:
   - Zoom → pagination recalculation
   - Page navigation
   - Keyboard shortcuts

4. **Manual Tests**:
   - Pinch-to-zoom on touch devices
   - Ctrl+scroll on desktop
   - Arrow key navigation
   - Various recipe sizes
   - Edge cases (single item, very long items, etc.)

## Accessibility

- Keyboard navigation (arrow keys for prev/next)
- ARIA labels for all controls
- Screen reader announcements for page changes
- High contrast mode support
- Focus indicators
- Alternative text-only view option

## Future Enhancements

- **Timer integration**: Start timers for timed steps
- **Voice control**: "Next step", "Previous step" commands
- **Step completion tracking**: Check off completed steps
- **Shopping list generation**: Add ingredients to shopping list
- **Unit conversion**: Switch between metric/imperial
- **Image display**: Show images for steps
- **Print recipe**: Format for printing
- **Share recipe**: Export or share with others

## Dependencies

- React hooks (built-in)
- No additional libraries required
- Optional: react-spring for smooth animations

## Recipe Data Source

For this implementation plan, recipe data can come from:
- **Hardcoded recipes**: JSON files in repository
- **API**: Fetch from recipe API (future)
- **User input**: Allow users to create/edit recipes (future)
- **Import**: Import from URL or text (future)

## Integration with Other Features

- **Screen Rotation**: Recipe screen can be part of rotation schedule
- **Time-Specific Navigation**: Navigate to recipe at meal times
- **Voice Commands**: Control navigation via voice (future)
- **Settings**: Save preferred zoom level per user
