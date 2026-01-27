/**
 * Tests for ColorPicker component
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorPicker, PROFILE_COLORS } from "../color-picker";

describe("ColorPicker", () => {
  describe("rendering", () => {
    it("renders all profile colors", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      // Should render a button for each color
      const colorButtons = screen.getAllByRole("button");
      expect(colorButtons).toHaveLength(PROFILE_COLORS.length);
    });

    it("renders color buttons with correct aria-labels", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      // Each color should have an accessible label
      PROFILE_COLORS.forEach((color) => {
        expect(
          screen.getByRole("button", { name: new RegExp(color.name, "i") })
        ).toBeInTheDocument();
      });
    });

    it("renders selected color with checkmark", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      // Find the selected button
      const selectedButton = screen.getByRole("button", { name: /blue/i });
      expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    });

    it("marks unselected colors as not pressed", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      // Find an unselected button
      const unselectedButton = screen.getByRole("button", { name: /green/i });
      expect(unselectedButton).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("interaction", () => {
    it("calls onChange when color is clicked", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      const greenButton = screen.getByRole("button", { name: /green/i });
      fireEvent.click(greenButton);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("#22c55e");
    });

    it("does not call onChange when clicking already selected color", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      const blueButton = screen.getByRole("button", { name: /blue/i });
      fireEvent.click(blueButton);

      // Should not trigger onChange since it's already selected
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("supports keyboard activation via Enter", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      const greenButton = screen.getByRole("button", { name: /green/i });
      fireEvent.keyDown(greenButton, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("#22c55e");
    });

    it("supports keyboard activation via Space", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      const redButton = screen.getByRole("button", { name: /red/i });
      fireEvent.keyDown(redButton, { key: " " });

      expect(onChange).toHaveBeenCalledWith("#ef4444");
    });
  });

  describe("accessibility", () => {
    it("has proper role for color picker group", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      const group = screen.getByRole("group");
      expect(group).toHaveAttribute("aria-label", "Select profile color");
    });

    it("shows visible label when showLabel is true", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} showLabel />);

      expect(screen.getByText("Profile Color")).toBeInTheDocument();
    });

    it("hides label by default", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} />);

      expect(screen.queryByText("Profile Color")).not.toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("disables all buttons when disabled prop is true", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} disabled />);

      const colorButtons = screen.getAllByRole("button");
      colorButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("does not call onChange when disabled", () => {
      const onChange = vi.fn();
      render(<ColorPicker value="#3b82f6" onChange={onChange} disabled />);

      const greenButton = screen.getByRole("button", { name: /green/i });
      fireEvent.click(greenButton);

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
