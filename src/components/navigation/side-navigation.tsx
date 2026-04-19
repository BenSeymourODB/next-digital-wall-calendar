"use client";

/**
 * Side Navigation
 *
 * Persistent left-side navigation bar with one icon per main screen,
 * inspired by Skylight's wall-calendar interface. The active route is
 * highlighted via `usePathname()`, so it stays in sync whether the route
 * change was triggered by the user clicking a nav icon or by the screen
 * rotation scheduler calling `router.push()`.
 */
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  Home,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/recipe", label: "Recipe", icon: ChefHat },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/**
 * Returns true when `pathname` belongs to the section rooted at `href`.
 * "/" only matches itself; any other href matches exact or nested paths.
 */
function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const activeHref =
    NAV_ITEMS.find((item) => isActiveRoute(pathname, item.href))?.href ?? null;

  return (
    <nav
      aria-label="Main navigation"
      className="bg-sidebar-background text-sidebar-foreground border-sidebar-border fixed top-0 left-0 z-40 flex h-screen w-16 flex-col items-center gap-2 border-r py-4"
    >
      <ul className="flex flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === activeHref;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                role="link"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isActive) {
                    router.push(item.href);
                  }
                }}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70"
                )}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
