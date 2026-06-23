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
import { useLocalStorage } from "@/hooks/use-local-storage";
import type React from "react";
import { createContext, useContext, useEffect } from "react";

/** Tasks UI view mode. Mirrors the Calendar `view` axis. */
export type TasksViewMode = "list" | "grouped-by-list";

/** localStorage key for the user's last-active `TaskListConfig` id. */
export const TASKS_ACTIVE_CONFIG_LS_KEY = "tasks.activeConfigId";

/** localStorage key for the user's last-selected view mode. */
export const TASKS_VIEW_MODE_LS_KEY = "tasks.viewMode";

const DEFAULT_VIEW_MODE: TasksViewMode = "list";
const VALID_VIEW_MODES: ReadonlySet<string> = new Set([
  "list",
  "grouped-by-list",
]);

function isValidViewMode(value: unknown): value is TasksViewMode {
  return typeof value === "string" && VALID_VIEW_MODES.has(value);
}

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
  const [storedViewMode, setStoredViewMode] = useLocalStorage<TasksViewMode>(
    TASKS_VIEW_MODE_LS_KEY,
    initialViewMode ?? DEFAULT_VIEW_MODE
  );

  // Apply override props on mount when they're provided. `useLocalStorage`
  // is backed by `useSyncExternalStore`, so the `initialValue` argument is
  // only used when the storage key is absent; for a returning user with a
  // persisted value the override would be silently ignored without this
  // mount-only write through. Mirrors `CalendarProvider.initialView` /
  // `initialAgendaMode` (#150 / #238). Capturing the props once is
  // intentional: subsequent prop changes are owned by the parent
  // component (e.g. it remounts the provider on a URL change).
  useEffect(() => {
    if (initialActiveConfigId !== undefined) {
      setStoredConfigId(initialActiveConfigId);
    }
    if (initialViewMode !== undefined) {
      setStoredViewMode(initialViewMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve `activeConfig` with a stale-id fallback: if the persisted id
  // points at a config the user has since deleted (or to nothing on the
  // very first mount), fall through to the first available config rather
  // than rendering an empty surface that "should" have content.
  const resolvedConfig = configs.find((c) => c.id === storedConfigId);
  const activeConfig = resolvedConfig ?? configs[0] ?? null;

  // Reconcile a stale `storedConfigId` so the next reload starts on the
  // correct config without re-firing the fallback every render. Skipped
  // when `configs` is empty (no canonical id to write through yet).
  useEffect(() => {
    if (
      storedConfigId !== null &&
      !resolvedConfig &&
      activeConfig !== null &&
      activeConfig.id !== storedConfigId
    ) {
      setStoredConfigId(activeConfig.id);
    }
  }, [storedConfigId, resolvedConfig, activeConfig, setStoredConfigId]);

  // Validate the stored view mode against the current union. A
  // corrupted/manually-edited value (or one written by a future build
  // and read by an older one) is typed as `TasksViewMode` at compile
  // time but might not match the union at runtime; fall back to the
  // default rather than render with a value the rest of the codebase
  // doesn't recognise.
  const viewMode: TasksViewMode = isValidViewMode(storedViewMode)
    ? storedViewMode
    : DEFAULT_VIEW_MODE;

  const lists = activeConfig ? activeConfig.lists.filter((l) => l.enabled) : [];

  // Destructure the exact `useTasks` keys we forward instead of spreading,
  // so a future addition to `UseTasksReturn` whose name collides with a
  // provider-owned key (e.g. both expose `loading`) is caught by the type
  // checker at the assignment below rather than silently shadowing the
  // provider's value at runtime.
  const { tasks, loading, error, refreshTasks, updateTask } =
    useTasks(activeConfig);

  // Setters are exposed directly — they don't add type narrowing,
  // logging, or side effects, so wrapping them only adds a closure that
  // the React Compiler can't reason about. The public types in
  // `ITasksContext` constrain callers to the intended argument shape.
  const value: ITasksContext = {
    tasks,
    loading,
    error,
    refreshTasks,
    updateTask,
    configs,
    activeConfig,
    setActiveConfigId: setStoredConfigId,
    lists,
    viewMode,
    setViewMode: setStoredViewMode,
  };

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  );
}
