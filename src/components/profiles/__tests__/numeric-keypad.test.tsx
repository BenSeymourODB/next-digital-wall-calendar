/**
 * Tests for NumericKeypad component
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NumericKeypad } from "../numeric-keypad";

describe("NumericKeypad", () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnBackspace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders 12 buttons (0-9, backspace, submit)", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      // 10 digit buttons
      for (let i = 0; i <= 9; i++) {
        expect(
          screen.getByRole("button", { name: String(i) })
        ).toBeInTheDocument();
      }

      // Backspace and submit buttons
      expect(
        screen.getByRole("button", { name: /backspace/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /submit/i })
      ).toBeInTheDocument();
    });

    it("renders buttons in correct layout order", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const buttons = screen.getAllByRole("button");
      const buttonLabels = buttons.map(
        (b) => b.textContent?.trim() || b.getAttribute("aria-label")
      );

      // Layout: 1-3, 4-6, 7-9, backspace-0-submit
      expect(buttonLabels[0]).toBe("1");
      expect(buttonLabels[1]).toBe("2");
      expect(buttonLabels[2]).toBe("3");
      expect(buttonLabels[3]).toBe("4");
      expect(buttonLabels[4]).toBe("5");
      expect(buttonLabels[5]).toBe("6");
      expect(buttonLabels[6]).toBe("7");
      expect(buttonLabels[7]).toBe("8");
      expect(buttonLabels[8]).toBe("9");
      expect(buttonLabels[10]).toBe("0");
    });
  });

  describe("digit input", () => {
    it("calls onChange with digit on number click", () => {
      render(
        <NumericKeypad
          value="12"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "5" }));

      expect(mockOnChange).toHaveBeenCalledWith("125");
    });

    it("calls onChange with each digit clicked", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "1" }));
      expect(mockOnChange).toHaveBeenCalledWith("1");
    });

    it("respects maxLength prop", () => {
      render(
        <NumericKeypad
          value="1234"
          maxLength={4}
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "5" }));

      // Should not call onChange when at maxLength
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("allows input when below maxLength", () => {
      render(
        <NumericKeypad
          value="123"
          maxLength={6}
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "4" }));

      expect(mockOnChange).toHaveBeenCalledWith("1234");
    });
  });

  describe("backspace", () => {
    it("calls onBackspace on backspace click", () => {
      render(
        <NumericKeypad
          value="123"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /backspace/i }));

      expect(mockOnBackspace).toHaveBeenCalled();
    });

    it("can be clicked when value is not empty", () => {
      render(
        <NumericKeypad
          value="1"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const backspaceButton = screen.getByRole("button", {
        name: /backspace/i,
      });
      fireEvent.click(backspaceButton);

      expect(mockOnBackspace).toHaveBeenCalled();
    });
  });

  describe("submit", () => {
    it("calls onSubmit on submit click", () => {
      render(
        <NumericKeypad
          value="1234"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it("submit button is disabled when value is empty", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is enabled when value is not empty", () => {
      render(
        <NumericKeypad
          value="1234"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("disabled state", () => {
    it("disables all buttons when disabled prop is true", () => {
      render(
        <NumericKeypad
          value="123"
          disabled
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("does not call onChange when disabled", () => {
      render(
        <NumericKeypad
          value="12"
          disabled
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "5" }));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("does not call onBackspace when disabled", () => {
      render(
        <NumericKeypad
          value="123"
          disabled
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /backspace/i }));

      expect(mockOnBackspace).not.toHaveBeenCalled();
    });

    it("does not call onSubmit when disabled", () => {
      render(
        <NumericKeypad
          value="1234"
          disabled
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("keyboard support", () => {
    it("handles digit keys", async () => {
      const user = userEvent.setup();
      render(
        <NumericKeypad
          value="12"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      // Focus on the keypad container
      const keypad = screen.getByRole("group");
      keypad.focus();

      await user.keyboard("5");

      expect(mockOnChange).toHaveBeenCalledWith("125");
    });

    it("handles Backspace key", async () => {
      const user = userEvent.setup();
      render(
        <NumericKeypad
          value="123"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const keypad = screen.getByRole("group");
      keypad.focus();

      await user.keyboard("{Backspace}");

      expect(mockOnBackspace).toHaveBeenCalled();
    });

    it("handles Enter key for submit", async () => {
      const user = userEvent.setup();
      render(
        <NumericKeypad
          value="1234"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const keypad = screen.getByRole("group");
      keypad.focus();

      await user.keyboard("{Enter}");

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it("does not handle keyboard input when disabled", async () => {
      const user = userEvent.setup();
      render(
        <NumericKeypad
          value="12"
          disabled
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const keypad = screen.getByRole("group");
      keypad.focus();

      await user.keyboard("5");

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("ignores non-numeric keys", async () => {
      const user = userEvent.setup();
      render(
        <NumericKeypad
          value="12"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      const keypad = screen.getByRole("group");
      keypad.focus();

      await user.keyboard("abc");

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has accessible role for keypad", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      expect(screen.getByRole("group")).toBeInTheDocument();
    });

    it("has aria-label for keypad", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      expect(screen.getByLabelText(/numeric keypad/i)).toBeInTheDocument();
    });

    it("backspace button has accessible name", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      expect(
        screen.getByRole("button", { name: /backspace/i })
      ).toBeInTheDocument();
    });

    it("submit button has accessible name", () => {
      render(
        <NumericKeypad
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onBackspace={mockOnBackspace}
        />
      );

      expect(
        screen.getByRole("button", { name: /submit/i })
      ).toBeInTheDocument();
    });
  });
});
