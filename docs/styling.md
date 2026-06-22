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

## Dark Mode & Theme Scopes

The app ships three themes (`light`, `dark`, `wall-projector`), wired via
`next-themes`. The `dark:` Tailwind variant fires for descendants of `.dark`
and `.wall-projector`. CSS variables for shadcn/ui tokens are declared in
`src/app/globals.css` for each theme.

### ThemeScope islands

`ThemeScope` (`src/components/theme/theme-scope.tsx`) wraps a subtree in
`[data-theme-scope="light" | "dark"]`. Inside the wrapper, `globals.css`
re-declares every semantic token (`--background`, `--card`, …) to the chosen
scheme, so token-driven utilities flip regardless of the outer theme.

### `dark:` variant tightening (#324)

The `@custom-variant dark` selector in `globals.css` is tightened so that the
variant does **not** fire on descendants of `[data-theme-scope="light"]`, and
**does** fire on descendants of `[data-theme-scope="dark"]` (even under a
light outer theme). This neutralises a leakage problem with the shadcn
components that ship `dark:` overrides — see the audit log below.

Because `src/components/ui/**` is overwritten by `pnpm bump-ui`, fixing the
leakage per-component would not survive an upgrade. The central variant
tightening is the durable solution.

#### `dark:` audit (src/components/ui/)

The components below ship one or more `dark:` overrides. With the tightened
variant in place, all of these are safe to wrap in a `ThemeScope` — no
per-component cleanup is required.

- `badge.tsx`
- `button.tsx`
- `calendar.tsx`
- `chart.tsx`
- `checkbox.tsx`
- `context-menu.tsx`
- `dropdown-menu.tsx`
- `field.tsx`
- `input-group.tsx`
- `input-otp.tsx`
- `input.tsx`
- `kbd.tsx`
- `menubar.tsx`
- `radio-group.tsx`
- `select.tsx`
- `switch.tsx`
- `tabs.tsx`
- `textarea.tsx`
- `toggle.tsx`

Re-run `grep -rln 'dark:' src/components/ui/` after a `pnpm bump-ui` to
refresh the list.

### Authoring new themed components

1. Prefer **semantic tokens** (`bg-background`, `text-foreground`,
   `border-border`, etc.) — they flip automatically inside any
   `ThemeScope`.
2. Reach for `dark:` overrides only when you need a value that differs from
   the semantic token in dark mode. They are leak-safe across `ThemeScope`
   thanks to the tightened variant.
3. Ensure proper contrast in all three themes; test interactive states.

## Best Practices

1. **Use standard Tailwind colors** - Consistent with the Tailwind ecosystem
2. **Use CVA for variants** - Consistent component API
3. **Keep components accessible** - Follow WCAG guidelines
4. **Use semantic HTML** - Proper element hierarchy
5. **Test responsiveness** - Mobile-first approach
6. **Maintain consistency** - Follow established patterns
