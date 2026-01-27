"use client";

/**
 * NumericKeypad - A numeric keypad component for PIN entry
 *
 * Features:
 * - 3x4 grid layout (1-9, backspace, 0, submit)
 * - Large touch targets (56x56px minimum)
 * - Keyboard support (0-9, Backspace, Enter)
 * - Disabled state
 * - Accessible with ARIA labels
 */
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { ArrowLeft, Check } from "lucide-react";

export interface NumericKeypadProps {
  /** Current value */
  value: string;
  /** Called when a digit is added */
  onChange: (value: string) => void;
  /** Called when backspace is pressed */
  onBackspace: () => void;
  /** Called when submit is pressed */
  onSubmit: () => void;
  /** Maximum length of the value */
  maxLength?: number;
  /** Minimum length required to enable submit */
  minLength?: number;
  /** Whether the keypad is disabled */
  disabled?: boolean;
}

export function NumericKeypad({
  value,
  onChange,
  onBackspace,
  onSubmit,
  maxLength = 6,
  minLength = 1,
  disabled = false,
}: NumericKeypadProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle digit press
  const handleDigit = (digit: string) => {
    if (disabled) return;
    if (value.length >= maxLength) return;
    onChange(value + digit);
  };

  // Handle backspace press
  const handleBackspace = () => {
    if (disabled) return;
    onBackspace();
  };

  // Handle submit press
  const handleSubmit = () => {
    if (disabled) return;
    if (value.length < minLength) return;
    onSubmit();
  };

  // Keyboard event handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      // Handle digit keys
      if (/^[0-9]$/.test(event.key)) {
        if (value.length < maxLength) {
          onChange(value + event.key);
        }
        event.preventDefault();
        return;
      }

      // Handle backspace
      if (event.key === "Backspace") {
        onBackspace();
        event.preventDefault();
        return;
      }

      // Handle enter
      if (event.key === "Enter") {
        if (value.length >= minLength) {
          onSubmit();
        }
        event.preventDefault();
        return;
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [disabled, value, maxLength, minLength, onChange, onBackspace, onSubmit]);

  // Button styles
  const buttonBaseStyles = cn(
    "flex items-center justify-center",
    "h-14 w-14 min-h-[56px] min-w-[56px]",
    "rounded-lg text-xl font-medium",
    "transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
  );

  const digitButtonStyles = cn(
    buttonBaseStyles,
    "bg-gray-100 text-gray-900 hover:bg-gray-200",
    "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
  );

  const actionButtonStyles = cn(
    buttonBaseStyles,
    "bg-gray-200 text-gray-700 hover:bg-gray-300",
    "disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
  );

  const submitButtonStyles = cn(
    buttonBaseStyles,
    "bg-blue-600 text-white hover:bg-blue-700",
    "disabled:bg-blue-300 disabled:cursor-not-allowed"
  );

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Numeric keypad"
      tabIndex={0}
      className="grid grid-cols-3 gap-3 focus:outline-none"
    >
      {/* Row 1: 1, 2, 3 */}
      {["1", "2", "3"].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          disabled={disabled}
          className={digitButtonStyles}
        >
          {digit}
        </button>
      ))}

      {/* Row 2: 4, 5, 6 */}
      {["4", "5", "6"].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          disabled={disabled}
          className={digitButtonStyles}
        >
          {digit}
        </button>
      ))}

      {/* Row 3: 7, 8, 9 */}
      {["7", "8", "9"].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          disabled={disabled}
          className={digitButtonStyles}
        >
          {digit}
        </button>
      ))}

      {/* Row 4: Backspace, 0, Submit */}
      <button
        type="button"
        onClick={handleBackspace}
        disabled={disabled}
        aria-label="Backspace"
        className={actionButtonStyles}
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

      <button
        type="button"
        onClick={() => handleDigit("0")}
        disabled={disabled}
        className={digitButtonStyles}
      >
        0
      </button>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || value.length < minLength}
        aria-label="Submit"
        className={submitButtonStyles}
      >
        <Check className="h-6 w-6" />
      </button>
    </div>
  );
}
