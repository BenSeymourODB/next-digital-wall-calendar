/**
 * Tests for PinDisplay component
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PinDisplay } from "../pin-display";

describe("PinDisplay", () => {
  describe("rendering", () => {
    it("renders correct number of slots for default length (4)", () => {
      render(<PinDisplay value="" length={4} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      expect(dots).toHaveLength(4);
    });

    it("renders correct number of slots for custom length (6)", () => {
      render(<PinDisplay value="" length={6} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      expect(dots).toHaveLength(6);
    });

    it("renders correct number of slots for custom length (5)", () => {
      render(<PinDisplay value="" length={5} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      expect(dots).toHaveLength(5);
    });
  });

  describe("filled dots", () => {
    it("renders filled dots for entered digits", () => {
      render(<PinDisplay value="123" length={6} />);

      // First 3 should be filled
      const dot0 = screen.getByTestId("pin-dot-0");
      const dot1 = screen.getByTestId("pin-dot-1");
      const dot2 = screen.getByTestId("pin-dot-2");

      expect(dot0).toHaveClass("bg-gray-900");
      expect(dot1).toHaveClass("bg-gray-900");
      expect(dot2).toHaveClass("bg-gray-900");
    });

    it("renders empty circles for remaining slots", () => {
      render(<PinDisplay value="12" length={4} />);

      // Last 2 should be empty
      const dot2 = screen.getByTestId("pin-dot-2");
      const dot3 = screen.getByTestId("pin-dot-3");

      expect(dot2).not.toHaveClass("bg-gray-900");
      expect(dot3).not.toHaveClass("bg-gray-900");
      expect(dot2).toHaveClass("border-gray-300");
      expect(dot3).toHaveClass("border-gray-300");
    });

    it("renders all filled when value length equals total length", () => {
      render(<PinDisplay value="1234" length={4} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      dots.forEach((dot) => {
        expect(dot).toHaveClass("bg-gray-900");
      });
    });

    it("renders all empty when value is empty", () => {
      render(<PinDisplay value="" length={4} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      dots.forEach((dot) => {
        expect(dot).not.toHaveClass("bg-gray-900");
        expect(dot).toHaveClass("border-gray-300");
      });
    });
  });

  describe("error state", () => {
    it("applies error styling when hasError is true", () => {
      render(<PinDisplay value="12" length={4} hasError />);

      const container = screen.getByRole("status");
      expect(container).toHaveClass("animate-shake");
    });

    it("renders filled dots with error color when hasError is true", () => {
      render(<PinDisplay value="123" length={4} hasError />);

      const dot0 = screen.getByTestId("pin-dot-0");
      const dot1 = screen.getByTestId("pin-dot-1");
      const dot2 = screen.getByTestId("pin-dot-2");

      expect(dot0).toHaveClass("bg-red-600");
      expect(dot1).toHaveClass("bg-red-600");
      expect(dot2).toHaveClass("bg-red-600");
    });

    it("renders empty circles with error border when hasError is true", () => {
      render(<PinDisplay value="12" length={4} hasError />);

      const dot2 = screen.getByTestId("pin-dot-2");
      const dot3 = screen.getByTestId("pin-dot-3");

      expect(dot2).toHaveClass("border-red-300");
      expect(dot3).toHaveClass("border-red-300");
    });

    it("does not apply error styling when hasError is false", () => {
      render(<PinDisplay value="12" length={4} hasError={false} />);

      const container = screen.getByRole("status");
      expect(container).not.toHaveClass("animate-shake");
    });
  });

  describe("accessibility", () => {
    it("has status role", () => {
      render(<PinDisplay value="12" length={4} />);

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("has aria-label describing PIN entry progress", () => {
      render(<PinDisplay value="123" length={6} />);

      expect(
        screen.getByLabelText(/3 of 6 digits entered/i)
      ).toBeInTheDocument();
    });

    it("updates aria-label for different values", () => {
      render(<PinDisplay value="12345" length={6} />);

      expect(
        screen.getByLabelText(/5 of 6 digits entered/i)
      ).toBeInTheDocument();
    });

    it("has aria-label for empty value", () => {
      render(<PinDisplay value="" length={4} />);

      expect(
        screen.getByLabelText(/0 of 4 digits entered/i)
      ).toBeInTheDocument();
    });
  });

  describe("visual appearance", () => {
    it("dots have consistent size", () => {
      render(<PinDisplay value="12" length={4} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      dots.forEach((dot) => {
        expect(dot).toHaveClass("w-4");
        expect(dot).toHaveClass("h-4");
      });
    });

    it("dots are circular", () => {
      render(<PinDisplay value="12" length={4} />);

      const dots = screen.getAllByTestId(/^pin-dot-/);
      dots.forEach((dot) => {
        expect(dot).toHaveClass("rounded-full");
      });
    });
  });
});
