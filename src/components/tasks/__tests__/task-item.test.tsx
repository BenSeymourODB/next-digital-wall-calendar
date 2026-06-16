/**
 * Tests for TaskItem component
 */
import { type ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PointsProvider } from "../../rewards/points-context";
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
    assignments: [],
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

  describe("profile assignments", () => {
    const dad = {
      id: "profile-dad",
      name: "Dad",
      color: "#3b82f6",
      avatar: { type: "initials" as const, value: "D" },
    };
    const mom = {
      id: "profile-mom",
      name: "Mom",
      color: "#ef4444",
      avatar: { type: "initials" as const, value: "M" },
    };

    it("does not render an assignments region when there are no assignees", () => {
      render(
        <TaskItem
          task={createTask({ assignments: [] })}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.queryByLabelText(/assigned to/i)).not.toBeInTheDocument();
    });

    it("renders an avatar for the assigned profile", () => {
      render(
        <TaskItem
          task={createTask({
            assignments: [{ profileId: dad.id, profile: dad }],
          })}
          onToggle={mockOnToggle}
        />
      );

      const region = screen.getByLabelText(/assigned to dad/i);
      expect(region).toBeInTheDocument();
    });

    it("renders an avatar for each assigned profile when shared", () => {
      render(
        <TaskItem
          task={createTask({
            assignments: [
              { profileId: dad.id, profile: dad },
              { profileId: mom.id, profile: mom },
            ],
          })}
          onToggle={mockOnToggle}
        />
      );

      // Both names should appear in the assignment region's accessible
      // label so screen readers announce who owns the task.
      const region = screen.getByLabelText(/assigned to dad, mom/i);
      expect(region).toBeInTheDocument();
    });
  });

  describe("reward-point integration", () => {
    const mockFetch = vi.fn();

    function withPointsProvider(profileId: string | null) {
      return function Wrapper({ children }: { children: ReactNode }) {
        return (
          <PointsProvider profileId={profileId}>{children}</PointsProvider>
        );
      };
    }

    beforeEach(() => {
      vi.useRealTimers();
      mockFetch.mockReset();
      global.fetch = mockFetch;
    });

    it("awards points and shows the animation on first-time completion when rewards are enabled", async () => {
      mockFetch
        // GET /api/points (provider mount)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              totalPoints: 50,
              enabled: true,
              defaultTaskPoints: 10,
              showPointsOnCompletion: true,
            }),
        })
        // POST /api/points/award
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              newTotal: 60,
              alreadyAwarded: false,
            }),
        });

      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        <TaskItem
          task={createTask({ status: "needsAction", id: "task-xyz" })}
          onToggle={onToggle}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      // Give the GET fetch a tick to settle so the provider state is hot
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/points?profileId=profile-1",
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
      });

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/points/award",
          expect.objectContaining({ method: "POST" })
        );
      });

      // Animation banner appears with the configured default points
      expect(await screen.findByText(/\+10 points!/)).toBeInTheDocument();
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("does NOT award points when rewards are disabled at the account level", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            totalPoints: 0,
            enabled: false,
            defaultTaskPoints: 10,
            showPointsOnCompletion: true,
          }),
      });

      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        <TaskItem
          task={createTask({ status: "needsAction" })}
          onToggle={onToggle}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByRole("checkbox"));

      // No POST should fire when rewards are disabled.
      await new Promise((r) => setTimeout(r, 0));
      const calls = mockFetch.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("/api/points/award")
      );
      expect(calls).toHaveLength(0);
      expect(screen.queryByText(/\+10 points!/)).not.toBeInTheDocument();
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("does NOT award points on un-completing a task (completed → needsAction)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            totalPoints: 50,
            enabled: true,
            defaultTaskPoints: 10,
            showPointsOnCompletion: true,
          }),
      });

      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        <TaskItem
          task={createTask({ status: "completed" })}
          onToggle={onToggle}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByRole("checkbox"));

      await new Promise((r) => setTimeout(r, 0));
      const calls = mockFetch.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("/api/points/award")
      );
      expect(calls).toHaveLength(0);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("does NOT show the animation when alreadyAwarded is true (idempotency hit)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              totalPoints: 50,
              enabled: true,
              defaultTaskPoints: 10,
              showPointsOnCompletion: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              newTotal: 50,
              alreadyAwarded: true,
            }),
        });

      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        <TaskItem
          task={createTask({ status: "needsAction" })}
          onToggle={onToggle}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // No animation when the server reported an idempotency hit.
      expect(screen.queryByText(/\+10 points!/)).not.toBeInTheDocument();
    });

    it("does NOT show the animation when showPointsOnCompletion is false", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              totalPoints: 50,
              enabled: true,
              defaultTaskPoints: 10,
              showPointsOnCompletion: false,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              newTotal: 60,
              alreadyAwarded: false,
            }),
        });

      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        <TaskItem
          task={createTask({ status: "needsAction" })}
          onToggle={onToggle}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      expect(screen.queryByText(/\+10 points!/)).not.toBeInTheDocument();
    });

    it("renders without errors when no PointsProvider is mounted", async () => {
      const onToggle = vi.fn();
      const user = userEvent.setup();

      render(
        <TaskItem
          task={createTask({ status: "needsAction" })}
          onToggle={onToggle}
        />
      );

      await act(async () => {
        await user.click(screen.getByRole("checkbox"));
      });

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
