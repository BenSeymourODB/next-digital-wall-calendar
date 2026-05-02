"use client";

/**
 * useTasks - Hook for fetching and managing Google Tasks
 *
 * Features:
 * - Fetches tasks from all enabled task lists
 * - Filters completed tasks based on config
 * - Optional per-profile filter (assigned + optional unassigned)
 * - Sorts tasks by due date, created date, or manual order
 * - Provides updateTask function for toggling completion
 * - Auto-refreshes on config change
 */
import { useCallback, useEffect, useState } from "react";
import {
  type GoogleTask,
  type TaskListConfig,
  type TaskWithMeta,
  type TasksApiResponse,
  isTaskOverdue,
  sortTasks,
} from "./types";

export interface UseTasksReturn {
  /** List of tasks enriched with list metadata */
  tasks: TaskWithMeta[];
  /** Whether tasks are currently being fetched */
  loading: boolean;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** Manually refresh tasks */
  refreshTasks: () => Promise<void>;
  /** Update a specific task */
  updateTask: (
    taskId: string,
    listId: string,
    updates: Partial<GoogleTask>
  ) => Promise<void>;
}

/**
 * Hook for fetching and managing tasks from Google Tasks API
 */
export function useTasks(config: TaskListConfig | null): UseTasksReturn {
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!config) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const enabledLists = config.lists.filter((l) => l.enabled);
    if (enabledLists.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const profileFilter = config.profileFilter ?? null;
    const showUnassigned = config.showUnassigned ?? false;
    // Only ask the server for assignments when we'll actually use them
    // for filtering or rendering. Avoids a needless DB query in the
    // simple "no profile filter" path.
    const includeAssignments = profileFilter !== null;

    try {
      // Fetch tasks from all enabled lists in parallel
      const taskPromises = enabledLists.map(async (list) => {
        const params = new URLSearchParams({ listId: list.listId });
        if (includeAssignments) {
          params.set("includeAssignments", "true");
        }
        const response = await fetch(`/api/tasks?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch tasks from list ${list.listTitle}`);
        }

        const data = (await response.json()) as TasksApiResponse;
        return { list, tasks: data.tasks || [] };
      });

      const results = await Promise.all(taskPromises);

      // Combine and enrich tasks with list metadata
      const allTasks: TaskWithMeta[] = results.flatMap(({ list, tasks }) =>
        tasks.map((task) => ({
          ...task,
          listId: list.listId,
          listTitle: list.listTitle,
          listColor: list.color,
          isOverdue: isTaskOverdue(task),
          assignments: task.assignments ?? [],
        }))
      );

      // Filter completed tasks if needed
      const completionFiltered = config.showCompleted
        ? allTasks
        : allTasks.filter((t) => t.status !== "completed");

      // Apply profile filter when configured
      const profileFiltered =
        profileFilter === null
          ? completionFiltered
          : completionFiltered.filter((task) => {
              const isAssignedToActive = task.assignments.some(
                (a) => a.profileId === profileFilter
              );
              if (isAssignedToActive) return true;
              return showUnassigned && task.assignments.length === 0;
            });

      // Sort tasks
      const sorted = sortTasks(profileFiltered, config.sortBy);

      setTasks(sorted);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch tasks"));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  const updateTask = useCallback(
    async (
      taskId: string,
      listId: string,
      updates: Partial<GoogleTask>
    ): Promise<void> => {
      const response = await fetch(`/api/tasks/${taskId}?listId=${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      // Refresh tasks after update
      await fetchTasks();
    },
    [fetchTasks]
  );

  // Fetch tasks when config changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refreshTasks: fetchTasks,
    updateTask,
  };
}
