/**
 * Tests for PIN validation utilities.
 */
import { describe, expect, it } from "vitest";
import { validatePinFormat } from "../pin-utils";

describe("validatePinFormat", () => {
  describe("valid PINs", () => {
    it.each([["1234"], ["12345"], ["123456"]])(
      "accepts a %s-digit numeric PIN",
      (pin) => {
        const result = validatePinFormat(pin);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    );
  });

  describe("invalid PINs", () => {
    it.each([
      ["123", "too short (3 digits)"],
      ["1234567", "too long (7 digits)"],
      ["12ab", "contains letters"],
      ["12 34", "contains whitespace"],
      ["12-34", "contains punctuation"],
      ["", "is empty"],
    ])("rejects %s — %s", (pin) => {
      const result = validatePinFormat(pin);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PIN must be 4-6 digits");
    });

    it("rejects undefined", () => {
      const result = validatePinFormat(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PIN must be 4-6 digits");
    });

    it("rejects null", () => {
      const result = validatePinFormat(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PIN must be 4-6 digits");
    });
  });

  describe("custom field label", () => {
    it("uses the provided field label in the error message", () => {
      const result = validatePinFormat("abc", { fieldLabel: "New PIN" });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("New PIN must be 4-6 digits");
    });

    it("does not affect valid results", () => {
      const result = validatePinFormat("1234", { fieldLabel: "New PIN" });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("falls back to 'PIN' when no label is given", () => {
      const result = validatePinFormat("abc");
      expect(result.error).toBe("PIN must be 4-6 digits");
    });
  });
});
