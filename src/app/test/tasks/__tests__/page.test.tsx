/**
 * Tests for `/test/tasks` page (#236).
 *
 * The page exposes three modes:
 * - `?lists=single` — renders a hard-coded single-list mock harness
 * - `?lists=multi`  — renders a hard-coded multi-list mock harness
 * - default         — live mode: fetches the user's real lists from
 *                     `/api/tasks/lists`, auto-selects the first, and
 *                     exposes a picker so the user can switch between
 *                     them. Renders loading / error / empty states.
 */
import { TaskList } from "@/components/tasks/task-list";
import type { TaskListConfig } from "@/components/tasks/types";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestTasksPage from "../page";

let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch,
}));

vi.mock("@/components/tasks/task-list", () => ({
  TaskList: vi.fn(() => null),
}));

const mockTaskList = vi.mocked(TaskList);

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function getRenderedConfig(callIndex = 0): TaskListConfig {
  const call = mockTaskList.mock.calls[callIndex];
  if (!call) {
    throw new Error(
      `TaskList was not rendered (looking for call ${callIndex}, ` +
        `received ${mockTaskList.mock.calls.length})`
    );
  }
  return (call[0] as { config: TaskListConfig }).config;
}

describe("/test/tasks page", () => {
  beforeEach(() => {
    mockSearch = new URLSearchParams();
    mockFetch.mockReset();
    mockTaskList.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("mock harness mode", () => {
    it("renders the single-list mock when ?lists=single", async () => {
      mockSearch = new URLSearchParams("lists=single");
      render(<TestTasksPage />);
      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());

      const config = getRenderedConfig();
      expect(config.lists).toHaveLength(1);
      expect(config.lists[0]).toMatchObject({
        listId: "list-groceries",
        listTitle: "Groceries",
        enabled: true,
      });
    });

    it("renders the multi-list mock when ?lists=multi", async () => {
      mockSearch = new URLSearchParams("lists=multi");
      render(<TestTasksPage />);
      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());

      const config = getRenderedConfig();
      expect(config.lists).toHaveLength(2);
      expect(config.lists.map((l) => l.listId)).toEqual([
        "list-groceries",
        "list-work",
      ]);
    });

    it("does not call the lists API in mock mode", async () => {
      mockSearch = new URLSearchParams("lists=single");
      render(<TestTasksPage />);
      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("live mode", () => {
    it("shows a loading state while /api/tasks/lists is in flight", async () => {
      let resolveFetch: ((value: Response) => void) | undefined;
      mockFetch.mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );

      render(<TestTasksPage />);

      expect(screen.getByTestId("test-tasks-live-loading")).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/lists");
      expect(mockTaskList).not.toHaveBeenCalled();

      // Cleanup: resolve the promise so the test doesn't leak.
      await act(async () => {
        resolveFetch?.(jsonResponse({ lists: [] }));
        await Promise.resolve();
      });
    });

    it("renders the error state when the lists fetch fails", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

      render(<TestTasksPage />);

      const errorBox = await screen.findByTestId("test-tasks-live-error");
      expect(errorBox).toBeInTheDocument();
      expect(errorBox).toHaveTextContent(/couldn.?t load your task lists/i);
      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
      expect(mockTaskList).not.toHaveBeenCalled();
    });

    it("retries the fetch when 'Try again' is clicked", async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
        .mockResolvedValueOnce(
          jsonResponse({
            lists: [
              { id: "abc", title: "Personal", updated: "2026-05-01T00:00Z" },
            ],
          })
        );

      const user = userEvent.setup();
      render(<TestTasksPage />);

      await screen.findByTestId("test-tasks-live-error");
      await user.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getRenderedConfig().lists[0].listId).toBe("abc");
    });

    it("renders the empty state when the user has no task lists", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ lists: [] }));

      render(<TestTasksPage />);

      const empty = await screen.findByTestId("test-tasks-live-empty");
      expect(empty).toBeInTheDocument();
      expect(empty).toHaveTextContent(/no task lists/i);
      expect(mockTaskList).not.toHaveBeenCalled();
    });

    it("auto-selects the first list and renders TaskList for it", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          lists: [
            { id: "list-a", title: "Personal", updated: "2026-05-01T00:00Z" },
            { id: "list-b", title: "Work", updated: "2026-05-01T00:00Z" },
          ],
        })
      );

      render(<TestTasksPage />);

      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());

      const picker = screen.getByLabelText(/^task list$/i);
      expect((picker as HTMLSelectElement).value).toBe("list-a");

      const config = getRenderedConfig();
      expect(config.lists).toHaveLength(1);
      expect(config.lists[0]).toMatchObject({
        listId: "list-a",
        listTitle: "Personal",
        enabled: true,
      });
    });

    it("re-renders TaskList for the chosen list when the picker changes", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          lists: [
            { id: "list-a", title: "Personal", updated: "2026-05-01T00:00Z" },
            { id: "list-b", title: "Work", updated: "2026-05-01T00:00Z" },
          ],
        })
      );

      const user = userEvent.setup();
      render(<TestTasksPage />);

      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());

      const picker = screen.getByLabelText(/^task list$/i);
      await user.selectOptions(picker, "list-b");

      await waitFor(() => {
        const latest =
          mockTaskList.mock.calls[mockTaskList.mock.calls.length - 1];
        const cfg = (latest?.[0] as { config: TaskListConfig }).config;
        expect(cfg.lists[0].listId).toBe("list-b");
      });
    });

    it("renders only the picker (no TaskList) until the fetch resolves", async () => {
      let resolveFetch: ((value: Response) => void) | undefined;
      mockFetch.mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );

      render(<TestTasksPage />);

      // Loading skeleton, no TaskList
      expect(screen.getByTestId("test-tasks-live-loading")).toBeInTheDocument();
      expect(mockTaskList).not.toHaveBeenCalled();

      await act(async () => {
        resolveFetch?.(
          jsonResponse({
            lists: [
              { id: "list-a", title: "Personal", updated: "2026-05-01T00:00Z" },
            ],
          })
        );
        await Promise.resolve();
      });

      await waitFor(() => expect(mockTaskList).toHaveBeenCalled());
      expect(
        screen.queryByTestId("test-tasks-live-loading")
      ).not.toBeInTheDocument();
    });
  });
});
