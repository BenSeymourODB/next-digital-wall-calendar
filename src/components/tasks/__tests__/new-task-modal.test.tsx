/**
 * Tests for NewTaskModal component
 */
import { signIn } from "next-auth/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewTaskModal, toApiDue } from "../new-task-modal";
import type { GoogleTask, TaskListSelection } from "../types";
// Import after mocking
import { TaskApiError, useCreateTask } from "../use-create-task";

vi.mock("../use-create-task", async () => {
  const actual =
    await vi.importActual<typeof import("../use-create-task")>(
      "../use-create-task"
    );
  return {
    ...actual,
    useCreateTask: vi.fn(),
  };
});

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

const mockUseCreateTask = vi.mocked(useCreateTask);

const sampleTask: GoogleTask = {
  id: "new-task-1",
  title: "Buy milk",
  status: "needsAction",
  updated: "2024-06-14T00:00:00Z",
  position: "00000000000000000000",
};

const lists: TaskListSelection[] = [
  { listId: "list-1", listTitle: "Groceries", color: "#ef4444", enabled: true },
  { listId: "list-2", listTitle: "Work", color: "#3b82f6", enabled: true },
];

describe("NewTaskModal", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockCreateTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateTask.mockReturnValue({
      createTask: mockCreateTask,
      loading: false,
      error: null,
    });
    mockCreateTask.mockResolvedValue(sampleTask);
  });

  describe("rendering", () => {
    it("does not render when closed", () => {
      render(
        <NewTaskModal
          open={false}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
        />
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders the dialog with all form fields when open", () => {
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
        />
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /add new task/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^list/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it("shows all available lists in the list dropdown", () => {
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
        />
      );
      const select = screen.getByLabelText(/^list/i) as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.textContent);
      expect(options).toContain("Groceries");
      expect(options).toContain("Work");
    });
  });

  describe("smart defaults", () => {
    it("pre-selects the supplied defaultListId", () => {
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-2"
        />
      );
      const select = screen.getByLabelText(/^list/i) as HTMLSelectElement;
      expect(select.value).toBe("list-2");
    });

    it("leaves the list unselected when no default is provided", () => {
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
        />
      );
      const select = screen.getByLabelText(/^list/i) as HTMLSelectElement;
      expect(select.value).toBe("");
    });
  });

  describe("validation", () => {
    it("shows an inline error when submitting with an empty title", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.click(screen.getByRole("button", { name: /add task/i }));

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("shows an inline error when submitting without selecting a list", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Buy milk");
      await user.click(screen.getByRole("button", { name: /add task/i }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        /please select a list/i
      );
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("clears the title error once the user types into the field", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.click(screen.getByRole("button", { name: /add task/i }));
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/title/i), "Buy milk");

      expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
    });

    it("treats whitespace-only titles as empty", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "   ");
      await user.click(screen.getByRole("button", { name: /add task/i }));

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  describe("submission", () => {
    it("calls createTask with the trimmed title and selected list", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "  Buy milk  ");
      await user.click(screen.getByRole("button", { name: /add task/i }));

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith({
          listId: "list-1",
          title: "Buy milk",
        });
      });
    });

    it("includes due date and notes when provided", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Buy milk");
      await user.type(screen.getByLabelText(/due date/i), "2026-05-10");
      await user.type(screen.getByLabelText(/notes/i), "Whole milk");
      await user.click(screen.getByRole("button", { name: /add task/i }));

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            listId: "list-1",
            title: "Buy milk",
            due: expect.stringMatching(/^2026-05-10/),
            notes: "Whole milk",
          })
        );
      });
    });

    it("invokes onSuccess and closes the modal on success", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Buy milk");
      await user.click(screen.getByRole("button", { name: /add task/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(sampleTask);
      });
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("keeps the modal open and shows the error when the API rejects", async () => {
      const user = userEvent.setup();
      mockCreateTask.mockRejectedValueOnce(new Error("Server unavailable"));
      mockUseCreateTask.mockReturnValue({
        createTask: mockCreateTask,
        loading: false,
        error: new Error("Server unavailable"),
      });

      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Buy milk");
      await user.click(screen.getByRole("button", { name: /add task/i }));

      await waitFor(() => {
        expect(screen.getByText(/server unavailable/i)).toBeInTheDocument();
      });
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("renders a Sign in again CTA and triggers re-auth when create fails with requiresReauth (#237)", async () => {
      const user = userEvent.setup();
      const reauthError = new TaskApiError(
        "Re-authentication required: Google Tasks scope missing.",
        403,
        true
      );
      mockUseCreateTask.mockReturnValue({
        createTask: mockCreateTask,
        loading: false,
        error: reauthError,
      });

      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      const reauthButton = await screen.findByRole("button", {
        name: /sign in again/i,
      });
      await user.click(reauthButton);

      expect(signIn).toHaveBeenCalledWith(
        "google",
        expect.objectContaining({ callbackUrl: expect.any(String) })
      );
    });

    it("preserves query params in the re-auth callbackUrl so the user lands back on their current view", async () => {
      const user = userEvent.setup();
      // Drive jsdom's location to a URL with both a path and a query so the
      // assertion exercises the full preserved value, not just the path.
      const originalUrl = window.location.href;
      window.history.replaceState(
        {},
        "",
        "/calendar?date=2026-05-04&view=week"
      );

      try {
        const reauthError = new TaskApiError(
          "Re-authentication required: Google Tasks scope missing.",
          403,
          true
        );
        mockUseCreateTask.mockReturnValue({
          createTask: mockCreateTask,
          loading: false,
          error: reauthError,
        });

        render(
          <NewTaskModal
            open={true}
            onOpenChange={mockOnOpenChange}
            onSuccess={mockOnSuccess}
            availableLists={lists}
            defaultListId="list-1"
          />
        );

        const reauthButton = await screen.findByRole("button", {
          name: /sign in again/i,
        });
        await user.click(reauthButton);

        expect(signIn).toHaveBeenCalledWith(
          "google",
          expect.objectContaining({
            callbackUrl: "/calendar?date=2026-05-04&view=week",
          })
        );
      } finally {
        window.history.replaceState({}, "", originalUrl);
      }
    });

    it("does not render the re-auth CTA on a generic error", () => {
      mockUseCreateTask.mockReturnValue({
        createTask: mockCreateTask,
        loading: false,
        error: new Error("Server unavailable"),
      });

      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      expect(
        screen.queryByRole("button", { name: /sign in again/i })
      ).not.toBeInTheDocument();
    });

    it("disables the submit button while loading", () => {
      mockUseCreateTask.mockReturnValue({
        createTask: mockCreateTask,
        loading: true,
        error: null,
      });

      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    });

    it("ignores submit attempts while a request is already in flight", async () => {
      const user = userEvent.setup();
      // Loading=true means createTask is already running; the form's
      // onSubmit must short-circuit rather than fire a second POST.
      mockUseCreateTask.mockReturnValue({
        createTask: mockCreateTask,
        loading: true,
        error: null,
      });

      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Buy milk");
      // Pressing Enter inside an input fires the form's submit handler
      // even though the submit button is `disabled`.
      await user.keyboard("{Enter}");

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("wires aria-describedby on the submit button when there is a server error", () => {
      mockUseCreateTask.mockReturnValue({
        createTask: mockCreateTask,
        loading: false,
        error: new Error("Server boom"),
      });

      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      const submit = screen.getByRole("button", { name: /add task/i });
      const describedBy = submit.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const banner = document.getElementById(describedBy ?? "");
      expect(banner).toHaveTextContent(/server boom/i);
    });
  });

  describe("cancel", () => {
    it("closes without calling createTask when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Buy milk");
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockCreateTask).not.toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("form reset", () => {
    it("resets the form when the dialog reopens", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      await user.type(screen.getByLabelText(/title/i), "Draft");
      expect(screen.getByLabelText(/title/i)).toHaveValue("Draft");

      // Close
      rerender(
        <NewTaskModal
          open={false}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      // Reopen
      rerender(
        <NewTaskModal
          open={true}
          onOpenChange={mockOnOpenChange}
          availableLists={lists}
          defaultListId="list-1"
        />
      );

      expect(screen.getByLabelText(/title/i)).toHaveValue("");
    });
  });
});

describe("toApiDue", () => {
  it("returns undefined for an empty string", () => {
    expect(toApiDue("")).toBeUndefined();
  });

  it("returns undefined for an unparseable value", () => {
    expect(toApiDue("not-a-date")).toBeUndefined();
    expect(toApiDue("2026/05/10")).toBeUndefined();
  });

  it("round-trips back to the same local calendar date", () => {
    // Whatever timezone the test runs in, the date the user picked
    // (2026-05-10) must come back as 2026-05-10 after parsing the
    // returned UTC instant locally — that's what formatDueDate does in
    // src/components/tasks/types.ts. A naïve `T00:00:00Z` would shift
    // by one day for any timezone west of UTC.
    const out = toApiDue("2026-05-10");
    expect(out).toBeTypeOf("string");
    const roundTrip = new Date(out as string);
    expect(roundTrip.getFullYear()).toBe(2026);
    expect(roundTrip.getMonth()).toBe(4); // May (0-indexed)
    expect(roundTrip.getDate()).toBe(10);
  });

  it("preserves single-digit months and days", () => {
    const out = toApiDue("2026-01-05");
    const roundTrip = new Date(out as string);
    expect(roundTrip.getFullYear()).toBe(2026);
    expect(roundTrip.getMonth()).toBe(0);
    expect(roundTrip.getDate()).toBe(5);
  });
});
