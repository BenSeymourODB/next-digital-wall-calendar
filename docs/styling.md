# Styling Guide

This document covers the styling approach, custom color system, and UI component conventions for this Next.js 16 template.

## Styling Approach

**Tailwind CSS 4** with shadcn/ui conventions:

- Component variants using `class-variance-authority` (CVA)
- Utility-first CSS with `tailwind-merge` for className merging
- Custom animations via `tw-animate-css`

**shadcn/ui components** are copied into `src/components/ui/` (not installed as package):

- Fully customizable and version-controlled
- Uses Radix UI primitives for accessibility
- Styled with Tailwind utilities

## Custom Color System

**⚠️ IMPORTANT:** This project uses a custom ODBM color palette defined in `src/styles/odbm.css`. **DO NOT use default Tailwind colors** like `bg-blue-600`, `text-red-500`, etc.

### Available Custom Colors

#### Brand Colors

- `gold` - Primary gold (#FAB432)
- `stone` - Dark gray (#58595B)
- `dark-blue` - Navy (#173A64)
- `donation-green` - Green (#69923E)
- `light-blue` - Sky blue (#6DACDE)
- `poppy` - Red-orange (#E84B25)
- `light-stone` - Light gray-blue (#D5E2E9)
- `ecru` - Cream (#E5DBB8)
- `orange` - Light orange (#FFD6A4)

#### Color Scales (50-950)

- `amber-*` (amber-50 through amber-950)
- `lime-*` (lime-50 through lime-950)
- `sky-*` (sky-50 through sky-950)
- `purple-*` (purple-50 through purple-950)
- `stone-*` (stone-25 through stone-950) - **Use for grays**
- `slate-*` (slate-50 through slate-950)
- `rose-*` (rose-50 through rose-950) - **Use for reds**

#### Semantic Colors

- `primary` = amber-400
- `secondary` = sky-900
- `destructive` = error (red)
- `background` = stone-25
- `foreground` = digital-text-stone

### Color Usage Guidelines

1. **Grays/Neutrals:** Use `stone-*` colors (e.g., `bg-stone-50`, `text-stone-900`, `border-stone-200`)
2. **Blue/Info:** Use `sky-*` colors (e.g., `bg-sky-600`, `text-sky-700`)
3. **Red/Error:** Use `rose-*` colors or `poppy` (e.g., `bg-rose-600`, `text-rose-700`)
4. **Orange/Warning:** Use `amber-*` colors (e.g., `bg-amber-600`, `text-amber-700`)
5. **Green/Success:** Use `lime-*` or `donation-green` (e.g., `bg-lime-600`, `text-donation-green`)

### Common Patterns

```tsx
// Background colors
className = "bg-stone-50"; // Light gray background
className = "bg-white"; // White background

// Text colors
className = "text-stone-900"; // Primary text
className = "text-stone-600"; // Secondary text
className = "text-stone-500"; // Tertiary text

// Borders
className = "border-stone-200"; // Default borders

// Interactive elements (buttons, links)
className = "bg-sky-600 hover:bg-sky-700 text-white"; // Primary action
className = "bg-stone-900 hover:bg-stone-800 text-white"; // Dark action
className = "bg-rose-600 hover:bg-rose-700 text-white"; // Error/Delete action
```

## Component Variants

When creating component variants, use `class-variance-authority` (CVA):

```tsx
import { type VariantProps, cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-sky-600 text-white hover:bg-sky-700",
        destructive: "bg-rose-600 text-white hover:bg-rose-700",
        outline: "border border-stone-200 bg-white hover:bg-stone-50",
        ghost: "hover:bg-stone-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## Accessibility

All UI components should follow these accessibility guidelines:

- Use semantic HTML elements
- Include proper ARIA labels and attributes
- Ensure keyboard navigation works
- Maintain sufficient color contrast
- Provide focus indicators

## Responsive Design

Use Tailwind's responsive prefixes:

```tsx
className = "text-sm md:text-base lg:text-lg"; // Responsive text sizes
className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"; // Responsive grids
className = "p-4 md:p-6 lg:p-8"; // Responsive spacing
```

## Dark Mode (Future)

This template currently doesn't include dark mode, but the color system is designed to support it. When implementing:

1. Add dark mode variants to all components
2. Use `dark:` prefix for dark mode styles
3. Ensure proper contrast in both modes
4. Test all interactive states

## Best Practices

1. **Always use custom colors** - Never use default Tailwind colors
2. **Use CVA for variants** - Consistent component API
3. **Keep components accessible** - Follow WCAG guidelines
4. **Use semantic HTML** - Proper element hierarchy
5. **Test responsiveness** - Mobile-first approach
6. **Maintain consistency** - Follow established patterns
