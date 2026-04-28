/**
 * Shared PIN validation utilities.
 */

const PIN_FORMAT = /^\d{4,6}$/;

export type PinFormatValidation =
  | { valid: true }
  | { valid: false; error: string };

export interface ValidatePinFormatOptions {
  /** Label used in the error message (e.g., "PIN", "New PIN"). Defaults to "PIN". */
  fieldLabel?: string;
}

/**
 * Validate that a PIN is a 4-6 digit numeric string.
 *
 * Accepts `undefined` / `null` so callers can pass request-body fields without
 * a separate presence check.
 */
export function validatePinFormat(
  pin: string | undefined | null,
  options: ValidatePinFormatOptions = {}
): PinFormatValidation {
  const fieldLabel = options.fieldLabel ?? "PIN";
  if (!pin || !PIN_FORMAT.test(pin)) {
    return { valid: false, error: `${fieldLabel} must be 4-6 digits` };
  }
  return { valid: true };
}
