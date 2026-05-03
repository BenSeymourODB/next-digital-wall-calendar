# Left-Side Navigation Bar

## Goal

Add a persistent left-side vertical navigation bar (Skylight-inspired) so users
can switch between the main app screens. Clicking a nav icon routes to that
screen with the same smooth transition animation that the screen rotation
scheduler already produces. The icon of the current screen is highlighted, and
that highlight updates whether the screen change came from a user click or from
the scheduler.

## Non-goals

- Mobile-first collapsible sidebar (this is a wall-mounted display)
- Re-implementing the scheduler's navigation controls
- Adding new app screens (only links to existing routes)
- Replacing the existing shadcn `sidebar` component elsewhere in the app

## Requirements

1. Vertical nav fixed on the left edge of the viewport
2. Icon buttons for the main screens: Home, Calendar, Recipe, Profiles,
   Settings (Tasks route does not yet exist; omit until implemented)
3. Active icon visually highlighted (background tint + primary foreground)
4. Clicking an icon calls `router.push()` — route change triggers a smooth
   slide transition
5. Scheduler-driven route changes also update the active highlight because
   the highlight is derived from `usePathname()`
6. Nav is hidden on routes where it does not belong: `/` (landing),
   `/auth/*`, `/test/*` (the scheduler-demo has its own shell), and any
   API routes
7. Uses `lucide-react` icons and existing `--sidebar-*` CSS tokens
8. Respects `prefers-reduced-motion` (inherited from `ScreenTransition`)

## Design

### Component: `SideNavigation`

File: `src/components/navigation/side-navigation.tsx`

Props: none — reads pathname via `usePathname()` and navigates via
`useRouter()`.

Structure:

```
<nav aria-label="Main navigation" class="fixed left-0 top-0 h-screen w-16 ...">
  <ul class="flex flex-col items-center gap-2 py-4">
    {items.map(item => <SideNavItem />)}
  </ul>
</nav>
```

Each item is a `<button>` (not `<Link>`) that calls `router.push(href)` so we
get a consistent interaction with the existing scheduler transition system
(both paths go through the Next.js router and a pathname change).

Active state: `pathname === item.href` (and for nested pages, `startsWith`).

### Component: `AppShell`

File: `src/components/navigation/app-shell.tsx`

A thin client wrapper that:

1. Reads `usePathname()`
2. If the path is in the "main app" set, renders `<SideNavigation />` plus a
   single `<ScreenTransition>` around the page content (offset left padding
   for the nav width)
3. Otherwise renders children plainly

Transition direction is derived from the index of the current route in the
nav items array vs the previous route — forward if moving "down", backward
if moving "up". First render is always forward. The previous pathname is
stored in a ref so the direction is only recomputed on actual path change.

### Integration

`src/app/layout.tsx` wraps `children` with `<AppShell>` inside the existing
provider tree. The scheduler-demo layout at `src/app/test/scheduler-demo/`
is unchanged — it still owns its own `ScreenScheduler` + `ScreenTransition`.

### Nav items

```ts
const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/recipe", label: "Recipe", icon: ChefHat },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

Paths where the shell wraps with nav + transition:

```ts
const APP_PATHS = ["/calendar", "/recipe", "/profiles", "/settings", "/tasks"];
```

(Home is linked but not itself wrapped; its existing layout stays intact.)

## Tests (TDD)

`src/components/navigation/__tests__/side-navigation.test.tsx`:

1. Renders one button per nav item with its aria-label
2. The button whose `href` matches the current pathname has
   `aria-current="page"` and the active style
3. Only one button has `aria-current="page"` at a time
4. Clicking a non-active button calls `router.push(href)` once
5. Clicking the already-active button does not push
6. Nested paths (`/profiles/new`) still highlight the `/profiles` item

`src/components/navigation/__tests__/app-shell.test.tsx`:

1. On `/calendar`, renders `<SideNavigation />` and wraps children in
   `ScreenTransition`
2. On `/`, renders children without nav or transition wrapper
3. On `/auth/signin`, renders children plainly
4. On `/test/scheduler-demo`, renders children plainly (no double-wrap)
5. Direction is `forward` when moving to a later nav item, `backward`
   when moving to an earlier one

Mock `next/navigation` (`useRouter`, `usePathname`) per the pattern already
used in `src/components/scheduler/__tests__/`.

## Acceptance

- `pnpm test` green
- `pnpm lint:fix && pnpm format:fix && pnpm check-types` all clean
- Manually verified: clicking an icon on `/calendar` → `/recipe` slides; the
  Recipe icon becomes the highlighted one
- Scheduler-driven navigation (on `/test/scheduler-demo/*`) is unaffected
