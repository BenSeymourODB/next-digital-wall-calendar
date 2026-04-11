/**
 * Shared mock components for Radix UI primitives that don't work in jsdom.
 *
 * These mocks are used across multiple settings component test files
 * (display-section, scheduler-section, transition-section) to replace
 * the Radix UI Slider which requires a real DOM.
 */

/**
 * Mock Slider component that renders as a native range input.
 * Use in vi.mock() factories:
 *
 * @example
 * ```ts
 * vi.mock("@/components/ui/slider", () => ({
 *   Slider: MockSlider,
 * }));
 * ```
 */
export function MockSlider({
  value,
  onValueChange,
  id,
}: {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  onValueChange: (value: number[]) => void;
}) {
  return (
    <input
      type="range"
      data-testid={id ?? "slider"}
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  );
}
