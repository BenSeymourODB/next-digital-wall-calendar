# Styling Guide

This document covers the styling approach and UI component conventions for the Digital Wall Calendar.

## Styling Approach

**Tailwind CSS 4** with shadcn/ui conventions:

- Component variants using `class-variance-authority` (CVA)
- Utility-first CSS with `tailwind-merge` for className merging
- Custom animations via `tw-animate-css`

**shadcn/ui components** are copied into `src/components/ui/` (not installed as package):

- Fully customizable and version-controlled
- Uses Radix UI primitives for accessibility
- Styled with Tailwind utilities

## Color System

This project uses **standard Tailwind CSS colors**. Use the default Tailwind color palette for all styling.

### Available Colors

Tailwind CSS provides comprehensive color scales from 50-950 for each color:

- **Gray** - For neutrals and text (`gray-50` through `gray-950`)
- **Blue** - For primary actions and info (`blue-50` through `blue-950`)
- **Red** - For errors and destructive actions (`red-50` through `red-950`)
- **Yellow** - For warnings (`yellow-50` through `yellow-950`)
- **Green** - For success states (`green-50` through `green-950`)
- **Purple** - For special highlights (`purple-50` through `purple-950`)
- **Orange** - For warnings and alerts (`orange-50` through `orange-950`)

### Color Usage Guidelines

1. **Grays/Neutrals:** Use `gray-*` colors (e.g., `bg-gray-50`, `text-gray-900`, `border-gray-200`)
2. **Blue/Info:** Use `blue-*` colors (e.g., `bg-blue-600`, `text-blue-700`)
3. **Red/Error:** Use `red-*` colors (e.g., `bg-red-600`, `text-red-700`)
4. **Yellow/Warning:** Use `yellow-*` colors (e.g., `bg-yellow-600`, `text-yellow-700`)
5. **Green/Success:** Use `green-*` colors (e.g., `bg-green-600`, `text-green-700`)

### Common Patterns

```tsx
// Background colors
className = "bg-gray-50"; // Light gray background
className = "bg-white"; // White background

// Text colors
className = "text-gray-900"; // Primary text
className = "text-gray-600"; // Secondary text
className = "text-gray-500"; // Tertiary text

// Borders
className = "border-gray-200"; // Default borders

// Interactive elements (buttons, links)
className = "bg-blue-600 hover:bg-blue-700 text-white"; // Primary action
className = "bg-gray-900 hover:bg-gray-800 text-white"; // Dark action
className = "bg-red-600 hover:bg-red-700 text-white"; // Error/Delete action
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
        default: "bg-blue-600 text-white hover:bg-blue-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-gray-200 bg-white hover:bg-gray-50",
        ghost: "hover:bg-gray-100",
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

This template currently doesn't include dark mode, but Tailwind's color system is designed to support it. When implementing:

1. Add dark mode variants to all components
2. Use `dark:` prefix for dark mode styles
3. Ensure proper contrast in both modes
4. Test all interactive states

## Best Practices

1. **Use standard Tailwind colors** - Consistent with the Tailwind ecosystem
2. **Use CVA for variants** - Consistent component API
3. **Keep components accessible** - Follow WCAG guidelines
4. **Use semantic HTML** - Proper element hierarchy
5. **Test responsiveness** - Mobile-first approach
6. **Maintain consistency** - Follow established patterns
