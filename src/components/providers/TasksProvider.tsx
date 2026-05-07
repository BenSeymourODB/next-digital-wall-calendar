"use client";

/**
 * TasksProvider — shared client-state container for the Tasks surface
 * (issue #331). Analogous to `CalendarProvider` for the calendar surface.
 *
 * Owns ephemeral UI state only:
 *
 *   - `activeConfig` — the `TaskListConfig` currently being rendered.
 *     Resolved by id against the `configs` prop with a stale-id fallback,
 *     so a removed config never leaves the surface in a wedged "no view"
 *     state.
 *   - `viewMode` — `"list"` or `"grouped-by-list"`, persisted across
 *     reloads.
 *
 * DB-backed settings (`taskSortOrder`, `showCompletedTasks`,
 * `defaultTaskListId`) deliberately stay with `useUserSettings` /
 * `ProfileSettings` and are NOT mirrored here — the provider is for
 * ephemeral UI state, not a second source of truth.
 *
 * The provider also calls `useTasks(activeConfig)` once and re-exposes
 * its `{ tasks, loading, error, refreshTasks, updateTask }` so descendants
 * (`TaskList`, `TasksSettingsPanel`, future `TasksPage`) read from one
 * canonical fetch lifecycle instead of each calling `useTasks` and racing
 * each other on the same config.
 */
import type {
  TaskListConfig,
  TaskListSelection,
} from "@/components/tasks/types";
import { type UseTasksReturn, useTasks } from "@/components/tasks/use-tasks";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type React from "react";
import { createContext, useContext } from "react";

/** Tasks UI view mode. Mirrors the Calendar `view` axis. */
export type TasksViewMode = "list" | "grouped-by-list";

/** localStorage key for the user's last-active `TaskListConfig` id. */
export const TASKS_ACTIVE_CONFIG_LS_KEY = "tasks.activeConfigId";

/** localStorage key for the user's last-selected view mode. */
export const TASKS_VIEW_MODE_LS_KEY = "tasks.viewMode";

const DEFAULT_VIEW_MODE: TasksViewMode = "list";

export interface ITasksContext extends UseTasksReturn {
  /**
   * All known `TaskListConfig` rows the provider can pick from. The
   * provider does not fetch these itself — the caller is expected to
   * supply them (for now hard-coded; #332 will populate from the DB).
   */
  configs: TaskListConfig[];
  /** The currently-rendered config. `null` when `configs` is empty. */
  activeConfig: TaskListConfig | null;
  /**
   * Switch the active config. Persists the id to `localStorage` so the
   * choice survives a reload.
   */
  setActiveConfigId: (id: string) => void;
  /**
   * Effective enabled lists from `activeConfig`. Empty when there is
   * no active config or every list is disabled.
   */
  lists: TaskListSelection[];
  /** Ephemeral UI view mode. */
  viewMode: TasksViewMode;
  /** Switch the view mode. Persists to `localStorage`. */
  setViewMode: (mode: TasksViewMode) => void;
}

const TasksContext = createContext<ITasksContext | null>(null);

/**
 * Read the Tasks context. Throws if called outside `TasksProvider` so
 * mis-mounted descendants fail loudly instead of silently no-op'ing.
 */
export function useTasksContext(): ITasksContext {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error("useTasksContext must be used within TasksProvider");
  }
  return ctx;
}

export interface TasksProviderProps {
  children: React.ReactNode;
  /**
   * The set of `TaskListConfig` rows the user can pick from. Defaults
   * to `[]` so the provider can mount before any configs exist (e.g.
   * the empty-state path on `/tasks`).
   */
  configs?: TaskListConfig[];
  /**
   * Optional override for the initial active config id. Used by deep
   * links (e.g. `/tasks?listConfig=...`) to win over the persisted
   * value on first mount.
   */
  initialActiveConfigId?: string;
  /** Optional override for the initial view mode. Same semantics. */
  initialViewMode?: TasksViewMode;
}

export function TasksProvider({
  children,
  configs = [],
  initialActiveConfigId,
  initialViewMode,
}: TasksProviderProps) {
  const [storedConfigId, setStoredConfigId] = useLocalStorage<string | null>(
    TASKS_ACTIVE_CONFIG_LS_KEY,
    initialActiveConfigId ?? null
  );
  const [viewMode, setStoredViewMode] = useLocalStorage<TasksViewMode>(
    TASKS_VIEW_MODE_LS_KEY,
    initialViewMode ?? DEFAULT_VIEW_MODE
  );

  // Resolve `activeConfig` with a stale-id fallback: if the persisted id
  // points at a config the user has since deleted (or to nothing on the
  // very first mount), fall through to the first available config rather
  // than rendering an empty surface that "should" have content.
  const activeConfig =
    configs.find((c) => c.id === storedConfigId) ?? configs[0] ?? null;

  const setActiveConfigId = (id: string) => {
    setStoredConfigId(id);
  };

  const setViewMode = (mode: TasksViewMode) => {
    setStoredViewMode(mode);
  };

  const lists = activeConfig ? activeConfig.lists.filter((l) => l.enabled) : [];

  const tasksApi = useTasks(activeConfig);

  const value: ITasksContext = {
    ...tasksApi,
    configs,
    activeConfig,
    setActiveConfigId,
    lists,
    viewMode,
    setViewMode,
  };

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  );
}
