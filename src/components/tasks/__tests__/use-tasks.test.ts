/**
 * Tests for useTasks hook
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleTask, TaskListConfig } from "../types";
import { useTasks } from "../use-tasks";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useTasks", () => {
  const createMockConfig = (
    overrides: Partial<TaskListConfig> = {}
  ): TaskListConfig => ({
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
    ...overrides,
  });

  const createMockTask = (overrides: Partial<GoogleTask> = {}): GoogleTask => ({
    id: "task-1",
    title: "Test Task",
    status: "needsAction",
    updated: "2024-06-14T00:00:00Z",
    position: "00000000000000000000",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with empty tasks and loading false when no config", () => {
      const { result } = renderHook(() => useTasks(null));

      expect(result.current.tasks).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("returns empty tasks when all lists are disabled", async () => {
      const config = createMockConfig({
        lists: [
          {
            listId: "list-1",
            listTitle: "Work",
            color: "#3b82f6",
            enabled: false,
          },
          {
            listId: "list-2",
            listTitle: "Personal",
            color: "#ef4444",
            enabled: false,
          },
        ],
      });
      const { result } = renderHook(() => useTasks(config));

      // Should not make any fetch calls
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.tasks).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("starts with loading true when config is provided", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ tasks: [] }),
                }),
              100
            )
          )
      );

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      expect(result.current.loading).toBe(true);
    });
  });

  describe("fetching tasks", () => {
    it("fetches tasks from enabled lists", async () => {
      const mockTasks = [createMockTask({ id: "task-1", title: "Task 1" })];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: mockTasks }),
      });

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tasks?listId=list-1")
      );
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe("Task 1");
    });

    it("does not fetch from disabled lists", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [] }),
      });

      const config = createMockConfig({
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
      });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("listId=list-1")
      );
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("listId=list-2")
      );
    });

    it("combines tasks from multiple lists", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1", title: "Work Task" })],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-2", title: "Personal Task" })],
            }),
        });

      const config = createMockConfig({
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
      });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      const titles = result.current.tasks.map((t) => t.title);
      expect(titles).toContain("Work Task");
      expect(titles).toContain("Personal Task");
    });

    it("enriches tasks with list metadata", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [createMockTask({ id: "task-1" })],
          }),
      });

      const config = createMockConfig({
        lists: [
          {
            listId: "list-1",
            listTitle: "Work",
            color: "#3b82f6",
            enabled: true,
          },
        ],
      });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      expect(result.current.tasks[0].listId).toBe("list-1");
      expect(result.current.tasks[0].listTitle).toBe("Work");
      expect(result.current.tasks[0].listColor).toBe("#3b82f6");
    });
  });

  describe("filtering", () => {
    it("filters out completed tasks when showCompleted is false", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              createMockTask({ id: "task-1", status: "needsAction" }),
              createMockTask({ id: "task-2", status: "completed" }),
            ],
          }),
      });

      const config = createMockConfig({ showCompleted: false });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      expect(result.current.tasks[0].id).toBe("task-1");
    });

    it("includes completed tasks when showCompleted is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              createMockTask({ id: "task-1", status: "needsAction" }),
              createMockTask({ id: "task-2", status: "completed" }),
            ],
          }),
      });

      const config = createMockConfig({ showCompleted: true });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });
    });
  });

  describe("sorting", () => {
    it("sorts by due date ascending", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              createMockTask({ id: "task-1", due: "2024-06-20T00:00:00Z" }),
              createMockTask({ id: "task-2", due: "2024-06-15T00:00:00Z" }),
              createMockTask({ id: "task-3", due: "2024-06-18T00:00:00Z" }),
            ],
          }),
      });

      const config = createMockConfig({ sortBy: "dueDate" });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(3);
      });

      expect(result.current.tasks.map((t) => t.id)).toEqual([
        "task-2",
        "task-3",
        "task-1",
      ]);
    });

    it("sorts by created date descending", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              createMockTask({ id: "task-1", updated: "2024-06-10T00:00:00Z" }),
              createMockTask({ id: "task-2", updated: "2024-06-15T00:00:00Z" }),
              createMockTask({ id: "task-3", updated: "2024-06-12T00:00:00Z" }),
            ],
          }),
      });

      const config = createMockConfig({ sortBy: "created" });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(3);
      });

      expect(result.current.tasks.map((t) => t.id)).toEqual([
        "task-2",
        "task-3",
        "task-1",
      ]);
    });

    it("sorts by manual position order", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              createMockTask({
                id: "task-1",
                position: "00000000000000000002",
              }),
              createMockTask({
                id: "task-2",
                position: "00000000000000000000",
              }),
              createMockTask({
                id: "task-3",
                position: "00000000000000000001",
              }),
            ],
          }),
      });

      const config = createMockConfig({ sortBy: "manual" });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(3);
      });

      expect(result.current.tasks.map((t) => t.id)).toEqual([
        "task-2",
        "task-3",
        "task-1",
      ]);
    });
  });

  describe("error handling", () => {
    it("sets error when fetch fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.tasks).toEqual([]);
    });

    it("sets error when network fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.tasks).toEqual([]);
    });

    it("fails all tasks when one list fetch fails (partial failure)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1", title: "Work Task" })],
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        });

      const config = createMockConfig({
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
      });
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // When one list fails, all fail (Promise.all behavior)
      expect(result.current.error).toBeTruthy();
      expect(result.current.tasks).toEqual([]);
    });
  });

  describe("updateTask", () => {
    it("calls PATCH API to update task", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1" })],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              task: createMockTask({ id: "task-1", status: "completed" }),
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1", status: "completed" })],
            }),
        });

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      await act(async () => {
        await result.current.updateTask("task-1", "list-1", {
          status: "completed",
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tasks/task-1?listId=list-1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "completed" }),
        })
      );
    });

    it("throws error when update fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1" })],
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        });

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      await expect(
        act(async () => {
          await result.current.updateTask("task-1", "list-1", {
            status: "completed",
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("refreshTasks", () => {
    it("refetches tasks when called", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1", title: "Original" })],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              tasks: [createMockTask({ id: "task-1", title: "Updated" })],
            }),
        });

      const config = createMockConfig();
      const { result } = renderHook(() => useTasks(config));

      await waitFor(() => {
        expect(result.current.tasks[0]?.title).toBe("Original");
      });

      await act(async () => {
        await result.current.refreshTasks();
      });

      await waitFor(() => {
        expect(result.current.tasks[0]?.title).toBe("Updated");
      });
    });
  });
});
