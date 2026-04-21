/**
 * Tests for PIN validation utilities.
 */
import { describe, expect, it } from "vitest";
import { validatePinFormat } from "../pin-utils";

describe("validatePinFormat", () => {
  describe("valid PINs", () => {
    it.each([["1234"], ["12345"], ["123456"]])(
      "accepts %s as a valid PIN",
      (pin) => {
        expect(validatePinFormat(pin)).toEqual({ valid: true });
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
      expect(validatePinFormat(pin)).toEqual({
        valid: false,
        error: "PIN must be 4-6 digits",
      });
    });

    it("rejects undefined", () => {
      expect(validatePinFormat(undefined)).toEqual({
        valid: false,
        error: "PIN must be 4-6 digits",
      });
    });

    it("rejects null", () => {
      expect(validatePinFormat(null)).toEqual({
        valid: false,
        error: "PIN must be 4-6 digits",
      });
    });
  });

  describe("custom field label", () => {
    it("uses the provided field label in the error message", () => {
      expect(validatePinFormat("abc", { fieldLabel: "New PIN" })).toEqual({
        valid: false,
        error: "New PIN must be 4-6 digits",
      });
    });

    it("does not affect valid results", () => {
      expect(validatePinFormat("1234", { fieldLabel: "New PIN" })).toEqual({
        valid: true,
      });
    });

    it("falls back to 'PIN' when no label is given", () => {
      expect(validatePinFormat("abc")).toEqual({
        valid: false,
        error: "PIN must be 4-6 digits",
      });
    });
  });
});
