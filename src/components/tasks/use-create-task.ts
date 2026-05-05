"use client";

/**
 * useCreateTask - hook for creating a Google Task via POST /api/tasks.
 *
 * Drives the {@link NewTaskModal} submit flow. Owns transient `loading`
 * and `error` state; consumers refresh their TaskList via the returned
 * task on success.
 */
import { useState } from "react";
import type { GoogleTask } from "./types";

export interface CreateTaskInput {
  listId: string;
  title: string;
  due?: string;
  notes?: string;
}

/**
 * Error thrown when `/api/tasks` returns a non-OK response. Carries the HTTP
 * status and the `requiresReauth` flag from the structured error body so
 * callers can render a "Sign in again" CTA without parsing the message.
 */
export class TaskApiError extends Error {
  readonly status: number;
  readonly requiresReauth: boolean;

  constructor(message: string, status: number, requiresReauth = false) {
    super(message);
    this.name = "TaskApiError";
    this.status = status;
    this.requiresReauth = requiresReauth;
  }
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
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          requiresReauth?: boolean;
        };
        throw new TaskApiError(
          payload.error || "Failed to create task",
          response.status,
          payload.requiresReauth === true
        );
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
