/**
 * Integration test for `TasksProvider` (#331) consumed by a `TaskList`-shaped
 * descendant.
 *
 * The unit tests in `TasksProvider.test.tsx` mock `useTasks` to assert the
 * provider's pass-through contract in isolation. This file goes one layer
 * deeper: it lets the real `useTasks` hook run inside the provider, mocks
 * only `fetch`, and confirms that:
 *
 *   1. tasks fetched against the active config render in a descendant that
 *      reads `useTasksContext().tasks` (not the `config` prop on
 *      `TaskList`).
 *   2. switching `activeConfigId` triggers a re-fetch against the new
 *      config's lists.
 *
 * This is the seam that #329 (`/tasks` page) and #333 (TasksSettingsPanel)
 * will rely on, so we want a regression net here before either lands.
 */
import {
  TasksProvider,
  useTasksContext,
} from "@/components/providers/TasksProvider";
import type { TaskListConfig } from "@/components/tasks/types";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use `vi.stubGlobal` so the patched `fetch` is automatically restored by
// `vi.unstubAllGlobals()` in `afterEach` — assigning to `global.fetch`
// directly would persist across test files in the same Vitest worker.
const mockFetch = vi.fn();

const configA: TaskListConfig = {
  id: "config-a",
  title: "Config A",
  showCompleted: false,
  sortBy: "dueDate",
  lists: [
    { listId: "list-a", listTitle: "List A", color: "#3b82f6", enabled: true },
  ],
};

const configB: TaskListConfig = {
  id: "config-b",
  title: "Config B",
  showCompleted: false,
  sortBy: "dueDate",
  lists: [
    { listId: "list-b", listTitle: "List B", color: "#22c55e", enabled: true },
  ],
};

function ContextConsumer() {
  const { activeConfig, tasks, loading, configs, setActiveConfigId } =
    useTasksContext();
  return (
    <div>
      <span data-testid="active-config">{activeConfig?.id ?? "none"}</span>
      <span data-testid="loading">{String(loading)}</span>
      <ul data-testid="tasks">
        {tasks.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
      {configs.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setActiveConfigId(c.id)}
        >
          {`switch-${c.id}`}
        </button>
      ))}
    </div>
  );
}

describe("TasksProvider — integration with real useTasks", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders tasks fetched for the active config", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tasks: [
          {
            id: "t1",
            title: "Buy groceries",
            status: "needsAction",
            updated: "2024-06-14T00:00:00Z",
            position: "00000000000000000000",
          },
        ],
      }),
    });

    render(
      <TasksProvider configs={[configA]}>
        <ContextConsumer />
      </TasksProvider>
    );

    expect(screen.getByTestId("active-config")).toHaveTextContent("config-a");

    await waitFor(() => {
      expect(screen.getByText("Buy groceries")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("listId=list-a");
  });

  it("re-fetches when the active config changes", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              id: "t1",
              title: "Task in A",
              status: "needsAction",
              updated: "2024-06-14T00:00:00Z",
              position: "00000000000000000000",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              id: "t2",
              title: "Task in B",
              status: "needsAction",
              updated: "2024-06-14T00:00:00Z",
              position: "00000000000000000000",
            },
          ],
        }),
      });

    const user = userEvent.setup();

    render(
      <TasksProvider configs={[configA, configB]}>
        <ContextConsumer />
      </TasksProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Task in A")).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText("switch-config-b"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("active-config")).toHaveTextContent("config-b");
    });
    await waitFor(() => {
      expect(screen.getByText("Task in B")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain("listId=list-b");
  });
});
