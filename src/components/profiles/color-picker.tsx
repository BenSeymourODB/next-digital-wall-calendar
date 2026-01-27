/**
 * Color picker component for profile color selection
 *
 * Features:
 * - Grid of predefined profile colors
 * - Visual selection indicator (checkmark)
 * - Keyboard navigation support
 * - Accessible with proper ARIA attributes
 */
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * Profile color options
 * Using Tailwind color palette for consistency
 */
export const PROFILE_COLORS = [
  { name: "Blue", hex: "#3b82f6" },
  { name: "Green", hex: "#22c55e" },
  { name: "Red", hex: "#ef4444" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Orange", hex: "#f97316" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Cyan", hex: "#06b6d4" },
] as const;

/**
 * ColorPicker component props
 */
export interface ColorPickerProps {
  /** Currently selected color hex value */
  value: string;
  /** Callback when color is selected */
  onChange: (color: string) => void;
  /** Whether to show the label */
  showLabel?: boolean;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

/**
 * Color picker component for selecting profile colors
 */
export function ColorPicker({
  value,
  onChange,
  showLabel = false,
  disabled = false,
}: ColorPickerProps) {
  const handleColorClick = (hex: string) => {
    if (!disabled && hex !== value) {
      onChange(hex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, hex: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleColorClick(hex);
    }
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <label className="text-sm font-medium text-gray-700">
          Profile Color
        </label>
      )}
      <div
        role="group"
        aria-label="Select profile color"
        className="flex flex-wrap gap-2"
      >
        {PROFILE_COLORS.map((color) => {
          const isSelected = value === color.hex;

          return (
            <button
              key={color.hex}
              type="button"
              role="button"
              aria-label={color.name}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => handleColorClick(color.hex)}
              onKeyDown={(e) => handleKeyDown(e, color.hex)}
              className={cn(
                "relative h-10 w-10 rounded-full border-2 transition-all",
                "focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none",
                isSelected
                  ? "border-gray-900 ring-2 ring-gray-900 ring-offset-2"
                  : "border-transparent hover:border-gray-300",
                disabled && "cursor-not-allowed opacity-50"
              )}
              style={{ backgroundColor: color.hex }}
            >
              {isSelected && (
                <Check
                  className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-md"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
