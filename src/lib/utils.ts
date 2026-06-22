import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS class names safely. Combines conditional classes via
 * `clsx` and resolves conflicting Tailwind utilities (e.g. `px-2` vs `px-4`)
 * via `tailwind-merge` so the last-specified utility wins.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
