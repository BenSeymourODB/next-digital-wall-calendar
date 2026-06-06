/**
 * Pure helper for the floating off-arc label feature (#311).
 *
 * Clamps a label's vertical position so the AnalogClockView grid row height
 * stays stable regardless of how many overflowing labels exist. The X
 * coordinate is preserved — the label's angular position on the invisible
 * outer circle is not adjusted to compensate for the clamp.
 *
 * Allowed band: `clockBox.top - 0.10 × clockBox.height` to
 * `clockBox.bottom + 0.10 × clockBox.height` (inclusive at both ends).
 */

const VERTICAL_OVERFLOW_RATIO = 0.1;

export interface ClockBox {
  /** SVG y-coordinate of the top edge of the clock face (incl. arc band). */
  top: number;
  /** SVG y-coordinate of the bottom edge of the clock face (incl. arc band). */
  bottom: number;
  /** Total clock height used to compute the 10% allowance. */
  height: number;
}

export function clampLabelPosition(
  position: { x: number; y: number },
  clockBox: ClockBox
): { x: number; y: number } {
  const allowance = clockBox.height * VERTICAL_OVERFLOW_RATIO;
  const upperLimit = clockBox.top - allowance;
  const lowerLimit = clockBox.bottom + allowance;
  const clampedY = Math.min(Math.max(position.y, upperLimit), lowerLimit);
  return { x: position.x, y: clampedY };
}
