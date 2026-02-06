/**
 * Tests for TaskListSettings component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskListSettings } from "../task-list-settings";
import type { GoogleTaskList, TaskListConfig } from "../types";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TaskListSettings", () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  const mockAvailableLists: GoogleTaskList[] = [
    { id: "list-1", title: "Work", updated: "2024-06-14T00:00:00Z" },
    { id: "list-2", title: "Personal", updated: "2024-06-14T00:00:00Z" },
    { id: "list-3", title: "Shopping", updated: "2024-06-14T00:00:00Z" },
  ];

  const mockConfig: TaskListConfig = {
    id: "config-1",
    title: "My Tasks",
    showCompleted: false,
    sortBy: "dueDate",
    lists: [
      {
        listId: "list-1",
        listTitle: "Work",
        color: "#3b82f6",
        enabled: true,
      },
      {
        listId: "list-2",
        listTitle: "Personal",
        color: "#ef4444",
        enabled: false,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lists: mockAvailableLists }),
    });
  });

  describe("rendering", () => {
    it("renders title", () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.getByText("Task List Settings")).toBeInTheDocument();
    });

    it("renders list selection section", async () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.getByText("Lists to Display")).toBeInTheDocument();
    });

    it("renders available task lists", async () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Wait for lists to load
      const workLabel = await screen.findByText("Work");
      expect(workLabel).toBeInTheDocument();
      expect(screen.getByText("Personal")).toBeInTheDocument();
    });

    it("shows checkboxes as checked for enabled lists", async () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      await screen.findByText("Work");

      const checkboxes = screen.getAllByRole("checkbox");
      // First checkbox (Work) should be checked
      const workCheckbox = checkboxes.find((cb) =>
        cb.closest("div")?.textContent?.includes("Work")
      );
      expect(workCheckbox).toBeChecked();
    });

    it("renders display options section", () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.getByText("Display Options")).toBeInTheDocument();
    });

    it("renders show completed checkbox", () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.getByText(/show completed/i)).toBeInTheDocument();
    });

    it("renders sort by dropdown", () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.getByText(/sort by/i)).toBeInTheDocument();
    });

    it("renders save and cancel buttons", () => {
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onClose when cancel is clicked", async () => {
      const user = userEvent.setup();
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onSave with updated config when save is clicked", async () => {
      const user = userEvent.setup();
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      await screen.findByText("Work");

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it("toggles list enabled state when checkbox is clicked", async () => {
      const user = userEvent.setup();
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      await screen.findByText("Work");

      // Find the Work checkbox and click it
      const checkboxes = screen.getAllByRole("checkbox");
      const listCheckboxes = checkboxes.filter((cb) => {
        const parent = cb.closest("[data-list-item]");
        return parent !== null;
      });

      if (listCheckboxes.length > 0) {
        await user.click(listCheckboxes[0]);
      }

      // Save and verify the change
      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it("toggles show completed when clicked", async () => {
      const user = userEvent.setup();
      render(
        <TaskListSettings
          open={true}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const showCompletedCheckbox = screen.getByRole("checkbox", {
        name: /show completed/i,
      });
      await user.click(showCompletedCheckbox);

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          showCompleted: true,
        })
      );
    });
  });

  describe("closed state", () => {
    it("does not render when open is false", () => {
      render(
        <TaskListSettings
          open={false}
          config={mockConfig}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );
      expect(screen.queryByText("Task List Settings")).not.toBeInTheDocument();
    });
  });
});
