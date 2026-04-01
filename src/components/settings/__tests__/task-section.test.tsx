/**
 * Tests for TaskSection component
 * Following TDD - tests are written before implementation
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSection } from "../task-section";

const defaultValues = {
  taskSortOrder: "dueDate",
  showCompletedTasks: false,
};

describe("TaskSection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sort order select", () => {
    render(<TaskSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText(/default sort order/i)).toBeInTheDocument();
  });

  it("renders show completed switch", () => {
    render(<TaskSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText(/show completed tasks/i)).toBeInTheDocument();
  });

  it("onChange fires when show completed is toggled", async () => {
    const user = userEvent.setup();

    render(<TaskSection values={defaultValues} onChange={mockOnChange} />);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ showCompletedTasks: true })
    );
  });

  it("shows correct initial show completed state", () => {
    render(
      <TaskSection
        values={{ ...defaultValues, showCompletedTasks: true }}
        onChange={mockOnChange}
      />
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("data-state", "checked");
  });
});
