"use client";

/**
 * useCreateTask - hook for creating a Google Task via POST /api/tasks.
 *
 * Drives the {@link NewTaskModal} submit flow. Owns transient `loading`
 * and `error` state; consumers refresh their TaskList via the returned
 * task on success.
 */
import { useState } from "react";
import { TaskApiError, parseTaskApiError } from "./task-api-error";
import type { GoogleTask } from "./types";

// Re-export so existing consumers can keep importing TaskApiError from
// the create-task module they were already wired to.
export { TaskApiError } from "./task-api-error";

export interface CreateTaskInput {
  listId: string;
  title: string;
  due?: string;
  notes?: string;
}

export interface UseCreateTaskReturn {
  createTask: (input: CreateTaskInput) => Promise<GoogleTask>;
  loading: boolean;
  error: Error | null;
}

export function useCreateTask(): UseCreateTaskReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createTask = async (input: CreateTaskInput): Promise<GoogleTask> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: input.listId,
          title: input.title,
          ...(input.due !== undefined ? { due: input.due } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        }),
      });

      if (!response.ok) {
        throw await parseTaskApiError(response, "Failed to create task");
      }

      const data = (await response.json()) as { task: GoogleTask };
      return data.task;
    } catch (err) {
      // Preserve TaskApiError so callers can branch on `status` /
      // `requiresReauth`; wrap anything else (network error, etc.) in a
      // plain Error to keep the public type simple.
      const wrapped =
        err instanceof TaskApiError
          ? err
          : err instanceof Error
            ? err
            : new Error(String(err));
      setError(wrapped);
      throw wrapped;
    } finally {
      setLoading(false);
    }
  };

  return { createTask, loading, error };
}
