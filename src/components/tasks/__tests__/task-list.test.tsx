/**
 * Tests for TaskList component
 */
import { signIn } from "next-auth/react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewTaskModal } from "../new-task-modal";
import { TaskApiError } from "../task-api-error";
import { TaskList } from "../task-list";
import type { TaskListConfig } from "../types";
// Import after mocking
import { useTasks } from "../use-tasks";

// Mock useTasks hook
vi.mock("../use-tasks", () => ({
  useTasks: vi.fn(),
}));

// Stub NewTaskModal so we can assert on the props TaskList passes in
// without re-testing the modal's internals here.
vi.mock("../new-task-modal", () => ({
  NewTaskModal: vi.fn(() => null),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

const mockUseTasks = vi.mocked(useTasks);
const mockNewTaskModal = vi.mocked(NewTaskModal);
const mockSignIn = vi.mocked(signIn);

describe("TaskList", () => {
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
    ],
  };

  const mockTasks = [
    {
      id: "task-1",
      title: "Task 1",
      status: "needsAction" as const,
      updated: "2024-06-14T00:00:00Z",
      position: "00000000000000000000",
      listId: "list-1",
      listTitle: "Work",
      listColor: "#3b82f6",
      isOverdue: false,
      assignments: [],
    },
    {
      id: "task-2",
      title: "Task 2",
      status: "needsAction" as const,
      updated: "2024-06-14T00:00:00Z",
      position: "00000000000000000001",
      listId: "list-1",
      listTitle: "Work",
      listColor: "#3b82f6",
      isOverdue: false,
      assignments: [],
    },
  ];

  const mockUpdateTask = vi.fn();
  const mockRefreshTasks = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTasks.mockReturnValue({
      tasks: mockTasks,
      loading: false,
      error: null,
      updateTask: mockUpdateTask,
      refreshTasks: mockRefreshTasks,
    });
  });

  describe("rendering", () => {
    it("renders component title", () => {
      render(<TaskList config={mockConfig} />);
      expect(screen.getByText("My Tasks")).toBeInTheDocument();
    });

    it("renders default title when not specified in config", () => {
      const configWithoutTitle = { ...mockConfig, title: undefined };
      render(<TaskList config={configWithoutTitle} />);
      expect(screen.getByText("My Tasks")).toBeInTheDocument();
    });

    it("renders custom title from config", () => {
      const configWithTitle = { ...mockConfig, title: "Work Tasks" };
      render(<TaskList config={configWithTitle} />);
      expect(screen.getByText("Work Tasks")).toBeInTheDocument();
    });

    it("renders settings button", () => {
      render(<TaskList config={mockConfig} />);
      const settingsButton = screen.getByRole("button", {
        name: /settings/i,
      });
      expect(settingsButton).toBeInTheDocument();
    });

    it("renders all tasks", () => {
      render(<TaskList config={mockConfig} />);
      expect(screen.getByText("Task 1")).toBeInTheDocument();
      expect(screen.getByText("Task 2")).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading indicator when loading", () => {
      mockUseTasks.mockReturnValue({
        tasks: [],
        loading: true,
        error: null,
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      render(<TaskList config={mockConfig} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error message when error occurs", () => {
      mockUseTasks.mockReturnValue({
        tasks: [],
        loading: false,
        error: new Error("Failed to fetch"),
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      render(<TaskList config={mockConfig} />);
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    it("renders a Sign in again CTA when error is a TaskApiError with requiresReauth (#261)", async () => {
      const user = userEvent.setup();
      mockUseTasks.mockReturnValue({
        tasks: [],
        loading: false,
        error: new TaskApiError(
          "Re-authentication required: Google Tasks scope missing.",
          403,
          true
        ),
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      render(<TaskList config={mockConfig} />);

      const reauthButton = screen.getByRole("button", {
        name: /sign in again/i,
      });
      await user.click(reauthButton);

      expect(mockSignIn).toHaveBeenCalledWith(
        "google",
        expect.objectContaining({ callbackUrl: expect.any(String) })
      );
    });

    it("does not render the Sign in again CTA on a generic error", () => {
      mockUseTasks.mockReturnValue({
        tasks: [],
        loading: false,
        error: new Error("Network failure"),
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      render(<TaskList config={mockConfig} />);

      expect(
        screen.queryByRole("button", { name: /sign in again/i })
      ).not.toBeInTheDocument();
    });

    it("does not render the Sign in again CTA on a TaskApiError without requiresReauth (#261)", () => {
      mockUseTasks.mockReturnValue({
        tasks: [],
        loading: false,
        error: new TaskApiError("Server error", 500, false),
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      render(<TaskList config={mockConfig} />);

      expect(
        screen.queryByRole("button", { name: /sign in again/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no tasks", () => {
      mockUseTasks.mockReturnValue({
        tasks: [],
        loading: false,
        error: null,
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      render(<TaskList config={mockConfig} />);
      expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
    });
  });

  describe("task interactions", () => {
    it("calls updateTask when task checkbox is toggled", async () => {
      const user = userEvent.setup();
      render(<TaskList config={mockConfig} />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(mockUpdateTask).toHaveBeenCalledWith("task-1", "list-1", {
        status: "completed",
      });
    });

    it("toggles from completed to needsAction", async () => {
      const completedTasks = [
        {
          ...mockTasks[0],
          status: "completed" as const,
        },
      ];
      mockUseTasks.mockReturnValue({
        tasks: completedTasks,
        loading: false,
        error: null,
        updateTask: mockUpdateTask,
        refreshTasks: mockRefreshTasks,
      });

      const user = userEvent.setup();
      render(<TaskList config={mockConfig} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(mockUpdateTask).toHaveBeenCalledWith("task-1", "list-1", {
        status: "needsAction",
      });
    });

    it("renders a Sign in again CTA when toggling a task fails with requiresReauth (#261)", async () => {
      const user = userEvent.setup();
      mockUpdateTask.mockRejectedValueOnce(
        new TaskApiError(
          "Re-authentication required: Google Tasks scope missing.",
          403,
          true
        )
      );

      render(<TaskList config={mockConfig} />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      const reauthButton = await screen.findByRole("button", {
        name: /sign in again/i,
      });
      await user.click(reauthButton);

      expect(mockSignIn).toHaveBeenCalledWith(
        "google",
        expect.objectContaining({ callbackUrl: expect.any(String) })
      );

      // The task list must NOT be wiped — toggle errors are scoped, not screen-level.
      expect(screen.getByText("Task 1")).toBeInTheDocument();
      expect(screen.getByText("Task 2")).toBeInTheDocument();
    });

    it("does not render the CTA when a toggle fails with a generic error", async () => {
      const user = userEvent.setup();
      mockUpdateTask.mockRejectedValueOnce(new Error("Network failure"));

      render(<TaskList config={mockConfig} />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // The toggle-error banner shows the message but no CTA on a non-reauth failure.
      expect(await screen.findByText(/network failure/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sign in again/i })
      ).not.toBeInTheDocument();
    });

    it("clears the toggle-error banner on the next successful toggle", async () => {
      const user = userEvent.setup();
      mockUpdateTask
        .mockRejectedValueOnce(new TaskApiError("Re-auth required", 403, true))
        .mockResolvedValueOnce(undefined);

      render(<TaskList config={mockConfig} />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      expect(
        await screen.findByRole("button", { name: /sign in again/i })
      ).toBeInTheDocument();

      await user.click(checkboxes[1]);

      expect(
        screen.queryByRole("button", { name: /sign in again/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("settings", () => {
    it("opens settings when settings button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnSettingsClick = vi.fn();

      render(
        <TaskList config={mockConfig} onSettingsClick={mockOnSettingsClick} />
      );

      const settingsButton = screen.getByRole("button", {
        name: /settings/i,
      });
      await user.click(settingsButton);

      expect(mockOnSettingsClick).toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("shows refresh button", () => {
      render(<TaskList config={mockConfig} />);
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it("calls refreshTasks when refresh button is clicked", async () => {
      const user = userEvent.setup();
      render(<TaskList config={mockConfig} />);

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      await user.click(refreshButton);

      expect(mockRefreshTasks).toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has accessible role structure", () => {
      render(<TaskList config={mockConfig} />);

      // Main container should be a list or region
      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
    });

    it("has accessible heading", () => {
      render(<TaskList config={mockConfig} />);

      const heading = screen.getByRole("heading", { name: "My Tasks" });
      expect(heading).toBeInTheDocument();
    });
  });

  describe("add task footer", () => {
    function lastModalProps() {
      const calls = mockNewTaskModal.mock.calls;
      return calls[calls.length - 1]?.[0];
    }

    it("renders an Add Task footer button", () => {
      render(<TaskList config={mockConfig} />);
      expect(
        screen.getByRole("button", { name: /add task/i })
      ).toBeInTheDocument();
    });

    it("disables the Add Task button when no lists are enabled", () => {
      const noEnabledConfig: TaskListConfig = {
        ...mockConfig,
        lists: mockConfig.lists.map((l) => ({ ...l, enabled: false })),
      };
      render(<TaskList config={noEnabledConfig} />);
      expect(screen.getByRole("button", { name: /add task/i })).toBeDisabled();
      expect(lastModalProps()?.availableLists).toEqual([]);
      expect(lastModalProps()?.defaultListId).toBeUndefined();
    });

    it("renders the modal closed by default", () => {
      render(<TaskList config={mockConfig} />);
      expect(lastModalProps()?.open).toBe(false);
    });

    it("opens the modal when the Add Task button is clicked", async () => {
      const user = userEvent.setup();
      render(<TaskList config={mockConfig} />);

      await user.click(screen.getByRole("button", { name: /add task/i }));

      expect(lastModalProps()?.open).toBe(true);
    });

    it("passes only enabled lists as availableLists", () => {
      const config: TaskListConfig = {
        ...mockConfig,
        lists: [
          {
            listId: "list-1",
            listTitle: "Work",
            color: "#3b82f6",
            enabled: true,
          },
          {
            listId: "list-2",
            listTitle: "Disabled",
            color: "#999",
            enabled: false,
          },
          {
            listId: "list-3",
            listTitle: "Personal",
            color: "#ef4444",
            enabled: true,
          },
        ],
      };
      render(<TaskList config={config} />);

      const props = lastModalProps();
      expect(props?.availableLists.map((l) => l.listId)).toEqual([
        "list-1",
        "list-3",
      ]);
    });

    it("pre-selects the only enabled list as the default", () => {
      render(<TaskList config={mockConfig} />);
      expect(lastModalProps()?.defaultListId).toBe("list-1");
    });

    it("leaves defaultListId undefined when multiple lists are enabled", () => {
      const config: TaskListConfig = {
        ...mockConfig,
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
            enabled: true,
          },
        ],
      };
      render(<TaskList config={config} />);
      expect(lastModalProps()?.defaultListId).toBeUndefined();
    });

    it("refreshes tasks when the modal reports a successful create", () => {
      render(<TaskList config={mockConfig} />);

      const props = lastModalProps();
      props?.onSuccess?.({
        id: "new-1",
        title: "Buy milk",
        status: "needsAction",
        updated: "2024-06-14T00:00:00Z",
        position: "0",
      });

      expect(mockRefreshTasks).toHaveBeenCalled();
    });

    it("closes the modal when onOpenChange(false) fires", async () => {
      const user = userEvent.setup();
      render(<TaskList config={mockConfig} />);

      await user.click(screen.getByRole("button", { name: /add task/i }));
      expect(lastModalProps()?.open).toBe(true);

      act(() => {
        lastModalProps()?.onOpenChange(false);
      });

      expect(lastModalProps()?.open).toBe(false);
    });
  });
});
