import { TEventColor } from "@/types/calendar";

/**
 * Reference hex values for Tailwind color palette
 * Using the base-500 shades for each color
 */
export const TAILWIND_COLORS: Record<TEventColor, string> = {
  blue: "#3b82f6", // blue-500
  green: "#22c55e", // green-500
  red: "#ef4444", // red-500
  yellow: "#eab308", // yellow-500
  purple: "#a855f7", // purple-500
  orange: "#f97316", // orange-500
};

/**
 * Parse hex color string to RGB components
 * @param hex - Hex color string (e.g., "#3b82f6" or "3b82f6")
 * @returns RGB components as { r, g, b } or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Validate hex format (6 characters)
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return null;
  }

  // Parse RGB components
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Calculate Euclidean distance between two RGB colors
 * Uses the formula: sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
 * @param hex1 - First hex color
 * @param hex2 - Second hex color
 * @returns Distance value (lower = more similar) or Number.MAX_VALUE if invalid
 */
export function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  // Return maximum distance if either color is invalid
  if (!rgb1 || !rgb2) {
    return Number.MAX_VALUE;
  }

  // Calculate Euclidean distance
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;

  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * Map a hex color to the closest Tailwind color
 * Uses RGB Euclidean distance to find the best match
 * @param hex - Hex color string from Google Calendar API
 * @returns Closest TEventColor or "blue" as fallback
 */
export function mapHexToTailwindColor(hex: string): TEventColor {
  // Validate input
  if (!hex || typeof hex !== "string") {
    return "blue";
  }

  // Calculate distance to each Tailwind color
  let minDistance = Number.MAX_VALUE;
  let closestColor: TEventColor = "blue";

  for (const [colorName, colorHex] of Object.entries(TAILWIND_COLORS)) {
    const distance = colorDistance(hex, colorHex);

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = colorName as TEventColor;
    }
  }

  return closestColor;
}
