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

export interface UseCreateTaskReturn {
  createTask: (input: CreateTaskInput) => Promise<GoogleTask>;
  loading: boolean;
  error: Error | null;
}

interface CreateTaskRequestBody {
  listId: string;
  title: string;
  due?: string;
  notes?: string;
}

function buildRequestBody(input: CreateTaskInput): CreateTaskRequestBody {
  const body: CreateTaskRequestBody = {
    listId: input.listId,
    title: input.title,
  };
  if (input.due !== undefined) body.due = input.due;
  if (input.notes !== undefined) body.notes = input.notes;
  return body;
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
        body: JSON.stringify(buildRequestBody(input)),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to create task");
      }

      const data = (await response.json()) as { task: GoogleTask };
      return data.task;
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      throw wrapped;
    } finally {
      setLoading(false);
    }
  };

  return { createTask, loading, error };
}
