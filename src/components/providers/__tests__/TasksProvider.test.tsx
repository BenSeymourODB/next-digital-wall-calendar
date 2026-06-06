/**
 * Tests for TasksProvider (#331).
 *
 * Covers ephemeral client state only — `activeConfig` resolution from a
 * `configs` prop, `viewMode` toggling, localStorage persistence, the
 * `useTasksContext()` error guard, and the pass-through of `useTasks`
 * results scoped to the active config.
 *
 * The DB-backed settings (`taskSortOrder`, `showCompletedTasks`,
 * `defaultTaskListId`) live in `UserSettings`/`ProfileSettings` and are
 * deliberately NOT owned by this provider — those tests live with the
 * settings hooks.
 */
import {
  TASKS_ACTIVE_CONFIG_LS_KEY,
  TASKS_VIEW_MODE_LS_KEY,
  TasksProvider,
  useTasksContext,
} from "@/components/providers/TasksProvider";
import type { TaskListConfig } from "@/components/tasks/types";
import type React from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock useTasks at the module boundary so the provider's pass-through path
// can be asserted without the fetch lifecycle. The real `useTasks` is
// covered by its own suite.
const useTasksMock = vi.fn();
vi.mock("@/components/tasks/use-tasks", () => ({
  useTasks: (config: TaskListConfig | null) => useTasksMock(config),
}));

const baseUseTasksReturn = {
  tasks: [],
  loading: false,
  error: null,
  refreshTasks: vi.fn(),
  updateTask: vi.fn(),
};

function makeConfig(overrides: Partial<TaskListConfig> = {}): TaskListConfig {
  return {
    id: "config-a",
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
        listTitle: "Archived",
        color: "#9ca3af",
        enabled: false,
      },
    ],
    ...overrides,
  };
}

function wrap(configs: TaskListConfig[] = []) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TasksProvider configs={configs}>{children}</TasksProvider>;
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useTasksMock.mockReset();
  useTasksMock.mockReturnValue(baseUseTasksReturn);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTasksContext", () => {
  it("throws a useful error when used outside TasksProvider", () => {
    // Suppress the React error-boundary console output for the throw path.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTasksContext())).toThrow(/TasksProvider/);
    errorSpy.mockRestore();
  });
});

describe("TasksProvider — activeConfig resolution", () => {
  it("returns null activeConfig and empty lists when configs is empty", () => {
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: wrap([]),
    });

    expect(result.current.activeConfig).toBeNull();
    expect(result.current.lists).toEqual([]);
    expect(result.current.configs).toEqual([]);
  });

  it("defaults activeConfig to the first config when nothing is persisted", () => {
    const configs = [
      makeConfig({ id: "config-a" }),
      makeConfig({ id: "config-b" }),
    ];
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: wrap(configs),
    });

    expect(result.current.activeConfig?.id).toBe("config-a");
  });

  it("rehydrates the active config from localStorage on mount", () => {
    window.localStorage.setItem(
      TASKS_ACTIVE_CONFIG_LS_KEY,
      JSON.stringify("config-b")
    );

    const configs = [
      makeConfig({ id: "config-a" }),
      makeConfig({ id: "config-b" }),
    ];
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: wrap(configs),
    });

    expect(result.current.activeConfig?.id).toBe("config-b");
  });

  it("falls back to the first config when the persisted id no longer exists and reconciles localStorage", async () => {
    window.localStorage.setItem(
      TASKS_ACTIVE_CONFIG_LS_KEY,
      JSON.stringify("config-stale")
    );

    const configs = [
      makeConfig({ id: "config-a" }),
      makeConfig({ id: "config-b" }),
    ];
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: wrap(configs),
    });

    expect(result.current.activeConfig?.id).toBe("config-a");

    // Reconciliation effect heals the stale key so the next reload starts
    // on the correct config without re-firing the fallback every render.
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(TASKS_ACTIVE_CONFIG_LS_KEY) ?? "null"
        )
      ).toBe("config-a");
    });
  });

  it("initialActiveConfigId wins over a previously-persisted id", async () => {
    window.localStorage.setItem(
      TASKS_ACTIVE_CONFIG_LS_KEY,
      JSON.stringify("config-a")
    );

    const configs = [
      makeConfig({ id: "config-a" }),
      makeConfig({ id: "config-b" }),
    ];
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: ({ children }) => (
        <TasksProvider configs={configs} initialActiveConfigId="config-b">
          {children}
        </TasksProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.activeConfig?.id).toBe("config-b");
    });

    // Override is also written through to storage so reload preserves it.
    expect(
      JSON.parse(
        window.localStorage.getItem(TASKS_ACTIVE_CONFIG_LS_KEY) ?? "null"
      )
    ).toBe("config-b");
  });

  it("computes lists as the enabled subset of the active config", () => {
    const configs = [makeConfig({ id: "config-a" })];
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: wrap(configs),
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].listId).toBe("list-1");
  });
});

describe("TasksProvider — switching active config", () => {
  function ActiveConfigProbe() {
    const { activeConfig, configs, setActiveConfigId } = useTasksContext();
    return (
      <div>
        <span data-testid="active">{activeConfig?.id ?? "none"}</span>
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

  it("setActiveConfigId switches activeConfig and persists to localStorage", async () => {
    const user = userEvent.setup();
    const configs = [
      makeConfig({ id: "config-a" }),
      makeConfig({ id: "config-b" }),
    ];

    render(
      <TasksProvider configs={configs}>
        <ActiveConfigProbe />
      </TasksProvider>
    );

    expect(screen.getByTestId("active")).toHaveTextContent("config-a");

    await user.click(screen.getByText("switch-config-b"));

    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("config-b");
    });

    expect(
      JSON.parse(
        window.localStorage.getItem(TASKS_ACTIVE_CONFIG_LS_KEY) ?? "null"
      )
    ).toBe("config-b");
  });
});

describe("TasksProvider — viewMode", () => {
  function ViewModeProbe() {
    const { viewMode, setViewMode } = useTasksContext();
    return (
      <div>
        <span data-testid="view-mode">{viewMode}</span>
        <button type="button" onClick={() => setViewMode("grouped-by-list")}>
          group
        </button>
        <button type="button" onClick={() => setViewMode("list")}>
          flat
        </button>
      </div>
    );
  }

  it("defaults viewMode to 'list'", () => {
    render(
      <TasksProvider configs={[]}>
        <ViewModeProbe />
      </TasksProvider>
    );

    expect(screen.getByTestId("view-mode")).toHaveTextContent("list");
  });

  it("setViewMode toggles and persists to localStorage", async () => {
    const user = userEvent.setup();

    render(
      <TasksProvider configs={[]}>
        <ViewModeProbe />
      </TasksProvider>
    );

    await user.click(screen.getByText("group"));

    await waitFor(() => {
      expect(screen.getByTestId("view-mode")).toHaveTextContent(
        "grouped-by-list"
      );
    });

    expect(
      JSON.parse(window.localStorage.getItem(TASKS_VIEW_MODE_LS_KEY) ?? "null")
    ).toBe("grouped-by-list");
  });

  it("rehydrates viewMode from localStorage on mount", () => {
    window.localStorage.setItem(
      TASKS_VIEW_MODE_LS_KEY,
      JSON.stringify("grouped-by-list")
    );

    render(
      <TasksProvider configs={[]}>
        <ViewModeProbe />
      </TasksProvider>
    );

    expect(screen.getByTestId("view-mode")).toHaveTextContent(
      "grouped-by-list"
    );
  });

  it("falls back to default viewMode when the stored value is not in the union", () => {
    // Corrupted/manually-edited or future-build payload — runtime value
    // doesn't match the current `TasksViewMode` union.
    window.localStorage.setItem(
      TASKS_VIEW_MODE_LS_KEY,
      JSON.stringify("nonsense")
    );

    render(
      <TasksProvider configs={[]}>
        <ViewModeProbe />
      </TasksProvider>
    );

    expect(screen.getByTestId("view-mode")).toHaveTextContent("list");
  });

  it("initialViewMode wins over a previously-persisted value", async () => {
    window.localStorage.setItem(
      TASKS_VIEW_MODE_LS_KEY,
      JSON.stringify("grouped-by-list")
    );

    render(
      <TasksProvider configs={[]} initialViewMode="list">
        <ViewModeProbe />
      </TasksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("view-mode")).toHaveTextContent("list");
    });
    expect(
      JSON.parse(window.localStorage.getItem(TASKS_VIEW_MODE_LS_KEY) ?? "null")
    ).toBe("list");
  });
});

describe("TasksProvider — useTasks pass-through", () => {
  it("calls useTasks with the active config and exposes its return values", () => {
    const refreshTasks = vi.fn();
    const updateTask = vi.fn();
    useTasksMock.mockReturnValue({
      tasks: [{ id: "t1" }],
      loading: true,
      error: null,
      refreshTasks,
      updateTask,
    });

    const configs = [makeConfig({ id: "config-a" })];
    const { result } = renderHook(() => useTasksContext(), {
      wrapper: wrap(configs),
    });

    expect(useTasksMock).toHaveBeenCalled();
    const lastArg = useTasksMock.mock.calls.at(-1)?.[0];
    expect(lastArg?.id).toBe("config-a");

    expect(result.current.tasks).toEqual([{ id: "t1" }]);
    expect(result.current.loading).toBe(true);
    expect(result.current.refreshTasks).toBe(refreshTasks);
    expect(result.current.updateTask).toBe(updateTask);
  });

  it("calls useTasks with null when configs is empty", () => {
    renderHook(() => useTasksContext(), { wrapper: wrap([]) });

    expect(useTasksMock).toHaveBeenCalledWith(null);
  });
});
