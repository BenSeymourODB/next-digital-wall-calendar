/**
 * Tests for TaskItem component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskItem } from "../task-item";
import type { TaskWithMeta } from "../types";

// Mock date for consistent testing
const MOCK_TODAY = new Date("2024-06-15T12:00:00Z");

describe("TaskItem", () => {
  const mockOnToggle = vi.fn();

  const createTask = (overrides: Partial<TaskWithMeta> = {}): TaskWithMeta => ({
    id: "task-1",
    title: "Test Task",
    status: "needsAction",
    updated: "2024-06-14T00:00:00Z",
    position: "00000000000000000000",
    listId: "list-1",
    listTitle: "My List",
    listColor: "#3b82f6",
    isOverdue: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders task title", () => {
      render(<TaskItem task={createTask()} onToggle={mockOnToggle} />);
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    it("renders color indicator with correct color", () => {
      render(
        <TaskItem
          task={createTask({ listColor: "#ef4444" })}
          onToggle={mockOnToggle}
        />
      );
      const colorIndicator = screen.getByTitle("My List");
      expect(colorIndicator).toHaveStyle({ backgroundColor: "#ef4444" });
    });

    it("renders checkbox unchecked for incomplete tasks", () => {
      render(
        <TaskItem
          task={createTask({ status: "needsAction" })}
          onToggle={mockOnToggle}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("renders checkbox checked for completed tasks", () => {
      render(
        <TaskItem
          task={createTask({ status: "completed" })}
          onToggle={mockOnToggle}
        />
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("renders notes when present", () => {
      render(
        <TaskItem
          task={createTask({ notes: "Task notes here" })}
          onToggle={mockOnToggle}
        />
      );
      expect(screen.getByText("Task notes here")).toBeInTheDocument();
    });

    it("does not render notes section when absent", () => {
      render(
        <TaskItem
          task={createTask({ notes: undefined })}
          onToggle={mockOnToggle}
        />
      );
      expect(screen.queryByText("Task notes here")).not.toBeInTheDocument();
    });
  });

  describe("due date display", () => {
    it("renders due date when present", () => {
      const tomorrow = new Date(MOCK_TODAY);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      render(
        <TaskItem
          task={createTask({ due: tomorrow.toISOString() })}
          onToggle={mockOnToggle}
        />
      );
      expect(screen.getByText(/Due:/)).toBeInTheDocument();
      expect(screen.getByText(/Tomorrow/)).toBeInTheDocument();
    });

    it("does not render due date when absent", () => {
      render(
        <TaskItem
          task={createTask({ due: undefined })}
          onToggle={mockOnToggle}
        />
      );
      expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
    });

    it("shows overdue styling for overdue tasks", () => {
      const yesterday = new Date(MOCK_TODAY);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      render(
        <TaskItem
          task={createTask({ due: yesterday.toISOString(), isOverdue: true })}
          onToggle={mockOnToggle}
        />
      );

      // The due date text should have red styling for overdue
      const dueText = screen.getByText(/Due:/).closest("div");
      expect(dueText).toHaveClass("text-red-600");
    });

    it("shows normal styling for tasks not overdue", () => {
      const tomorrow = new Date(MOCK_TODAY);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      render(
        <TaskItem
          task={createTask({ due: tomorrow.toISOString(), isOverdue: false })}
          onToggle={mockOnToggle}
        />
      );

      const dueText = screen.getByText(/Due:/).closest("div");
      expect(dueText).toHaveClass("text-gray-500");
    });
  });

  describe("completed task styling", () => {
    it("applies strikethrough to completed task title", () => {
      render(
        <TaskItem
          task={createTask({ status: "completed" })}
          onToggle={mockOnToggle}
        />
      );

      const title = screen.getByText("Test Task");
      expect(title).toHaveClass("line-through");
    });

    it("does not apply strikethrough to incomplete task title", () => {
      render(
        <TaskItem
          task={createTask({ status: "needsAction" })}
          onToggle={mockOnToggle}
        />
      );

      const title = screen.getByText("Test Task");
      expect(title).not.toHaveClass("line-through");
    });
  });

  describe("interactions", () => {
    it("calls onToggle when checkbox is clicked", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const user = userEvent.setup();
      render(<TaskItem task={createTask()} onToggle={mockOnToggle} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it("does not call onToggle when disabled", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const user = userEvent.setup();
      render(
        <TaskItem task={createTask()} onToggle={mockOnToggle} disabled={true} />
      );

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(mockOnToggle).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has accessible checkbox label", () => {
      render(<TaskItem task={createTask()} onToggle={mockOnToggle} />);

      const checkbox = screen.getByRole("checkbox", {
        name: /Test Task/i,
      });
      expect(checkbox).toBeInTheDocument();
    });

    it("color indicator has title for screen readers", () => {
      render(<TaskItem task={createTask()} onToggle={mockOnToggle} />);

      const colorIndicator = screen.getByTitle("My List");
      expect(colorIndicator).toBeInTheDocument();
    });
  });
});
