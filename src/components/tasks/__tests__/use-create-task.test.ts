/**
 * Tests for useCreateTask hook
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleTask } from "../types";
import { TaskApiError, useCreateTask } from "../use-create-task";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const sampleTask: GoogleTask = {
  id: "new-task-1",
  title: "Buy milk",
  status: "needsAction",
  updated: "2024-06-14T00:00:00Z",
  position: "00000000000000000000",
};

describe("useCreateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=false and error=null", () => {
    const { result } = renderHook(() => useCreateTask());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("POSTs the request to /api/tasks with the supplied fields", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ task: sampleTask }),
    });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask({
        listId: "list-1",
        title: "Buy milk",
        due: "2026-05-10",
        notes: "Whole milk",
      });
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      listId: "list-1",
      title: "Buy milk",
      due: "2026-05-10",
      notes: "Whole milk",
    });
  });

  it("returns the created task on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ task: sampleTask }),
    });

    const { result } = renderHook(() => useCreateTask());

    let returned: GoogleTask | undefined;
    await act(async () => {
      returned = await result.current.createTask({
        listId: "list-1",
        title: "Buy milk",
      });
    });

    expect(returned).toEqual(sampleTask);
  });

  it("toggles loading=true while the request is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => useCreateTask());

    let createPromise: Promise<GoogleTask> | undefined;
    act(() => {
      createPromise = result.current.createTask({
        listId: "list-1",
        title: "Buy milk",
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveFetch({
        ok: true,
        status: 201,
        json: async () => ({ task: sampleTask }),
      });
      await createPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("sets error and rethrows when the response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await expect(
        result.current.createTask({ listId: "list-1", title: "Buy milk" })
      ).rejects.toThrow(/boom/i);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/boom/i);
    expect(result.current.loading).toBe(false);
  });

  it("falls back to a generic message when the error body has no error field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await expect(
        result.current.createTask({ listId: "list-1", title: "Buy milk" })
      ).rejects.toThrow(/failed to create task/i);
    });
  });

  it("surfaces requiresReauth on 401 responses via the error message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: "Session expired. Please sign in again.",
        requiresReauth: true,
      }),
    });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await expect(
        result.current.createTask({ listId: "list-1", title: "Buy milk" })
      ).rejects.toThrow(/session expired/i);
    });
  });

  it("rejects with a TaskApiError carrying status and requiresReauth on 403 (#237)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: "Re-authentication required: Google Tasks scope missing.",
        requiresReauth: true,
      }),
    });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await expect(
        result.current.createTask({ listId: "list-1", title: "Buy milk" })
      ).rejects.toBeInstanceOf(TaskApiError);
    });

    const captured = result.current.error as TaskApiError | null;
    expect(captured).toBeInstanceOf(TaskApiError);
    expect(captured?.status).toBe(403);
    expect(captured?.requiresReauth).toBe(true);
    expect(captured?.message).toMatch(/Google Tasks/i);
  });

  it("propagates network failures into the error state", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network failure"));

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await expect(
        result.current.createTask({ listId: "list-1", title: "Buy milk" })
      ).rejects.toThrow(/network failure/i);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/network failure/i);
    expect(result.current.loading).toBe(false);
  });

  it("clears error state on a subsequent successful call", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "first failure" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ task: sampleTask }),
      });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await expect(
        result.current.createTask({ listId: "list-1", title: "Buy milk" })
      ).rejects.toThrow();
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.createTask({
        listId: "list-1",
        title: "Buy milk",
      });
    });
    expect(result.current.error).toBeNull();
  });

  it("omits undefined optional fields from the request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ task: sampleTask }),
    });

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask({
        listId: "list-1",
        title: "Buy milk",
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ listId: "list-1", title: "Buy milk" });
    expect(body).not.toHaveProperty("due");
    expect(body).not.toHaveProperty("notes");
  });
});
