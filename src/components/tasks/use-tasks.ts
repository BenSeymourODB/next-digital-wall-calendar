"use client";

/**
 * useTasks - Hook for fetching and managing Google Tasks
 *
 * Features:
 * - Fetches tasks from all enabled task lists
 * - Filters completed tasks based on config
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

    try {
      // Fetch tasks from all enabled lists in parallel
      const taskPromises = enabledLists.map(async (list) => {
        const response = await fetch(`/api/tasks?listId=${list.listId}`);

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
        }))
      );

      // Filter completed tasks if needed
      const filtered = config.showCompleted
        ? allTasks
        : allTasks.filter((t) => t.status !== "completed");

      // Sort tasks
      const sorted = sortTasks(filtered, config.sortBy);

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
