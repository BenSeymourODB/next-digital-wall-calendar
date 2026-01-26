"use client";

/**
 * PinDisplay - Visual PIN entry progress component
 *
 * Features:
 * - Filled circles (●) for entered digits
 * - Empty circles (○) for remaining slots
 * - Error state with red border and shake animation
 * - Supports 4-6 slots
 */
import { cn } from "@/lib/utils";

export interface PinDisplayProps {
  /** Current PIN value */
  value: string;
  /** Total number of PIN digits */
  length: number;
  /** Whether to show error styling */
  hasError?: boolean;
}

export function PinDisplay({
  value,
  length,
  hasError = false,
}: PinDisplayProps) {
  const filledCount = value.length;

  return (
    <div
      role="status"
      aria-label={`${filledCount} of ${length} digits entered`}
      className={cn(
        "flex items-center justify-center gap-3",
        hasError && "animate-shake"
      )}
    >
      {Array.from({ length }).map((_, index) => {
        const isFilled = index < filledCount;
        return (
          <div
            key={index}
            data-testid={`pin-dot-${index}`}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-colors",
              isFilled
                ? hasError
                  ? "border-red-600 bg-red-600"
                  : "border-gray-900 bg-gray-900"
                : hasError
                  ? "border-red-300 bg-transparent"
                  : "border-gray-300 bg-transparent"
            )}
          />
        );
      })}
    </div>
  );
}
