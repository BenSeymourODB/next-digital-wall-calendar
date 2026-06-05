/**
 * Tests for the shared TaskApiError class and parseTaskApiError helper.
 *
 * Covers the contract every tasks consumer relies on: the `status` and
 * `requiresReauth` fields the routes return on 401/403 should make it
 * onto the thrown error so UIs can render a re-auth CTA.
 */
import { describe, expect, it } from "vitest";
import { TaskApiError, parseTaskApiError } from "../task-api-error";

describe("TaskApiError", () => {
  it("extends Error and exposes status + requiresReauth", () => {
    const err = new TaskApiError("boom", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskApiError);
    expect(err.name).toBe("TaskApiError");
    expect(err.message).toBe("boom");
    expect(err.status).toBe(500);
    expect(err.requiresReauth).toBe(false);
  });

  it("accepts requiresReauth=true", () => {
    const err = new TaskApiError("re-auth", 403, true);
    expect(err.status).toBe(403);
    expect(err.requiresReauth).toBe(true);
  });
});

describe("parseTaskApiError", () => {
  function buildResponse(
    status: number,
    body: unknown,
    { jsonThrows = false }: { jsonThrows?: boolean } = {}
  ) {
    return {
      ok: false,
      status,
      json: jsonThrows
        ? () => Promise.reject(new SyntaxError("invalid json"))
        : () => Promise.resolve(body),
    } as unknown as Response;
  }

  it("returns a TaskApiError carrying status + requiresReauth from the body", async () => {
    const response = buildResponse(403, {
      error: "Re-authentication required: Google Tasks scope missing.",
      requiresReauth: true,
    });

    const err = await parseTaskApiError(response, "fallback");

    expect(err).toBeInstanceOf(TaskApiError);
    expect(err.status).toBe(403);
    expect(err.requiresReauth).toBe(true);
    expect(err.message).toMatch(/google tasks/i);
  });

  it("uses the fallback message when the body has no error field", async () => {
    const response = buildResponse(500, {});

    const err = await parseTaskApiError(response, "Failed to fetch tasks");

    expect(err.message).toBe("Failed to fetch tasks");
    expect(err.status).toBe(500);
    expect(err.requiresReauth).toBe(false);
  });

  it("defaults requiresReauth to false when body omits the flag", async () => {
    const response = buildResponse(401, { error: "session expired" });

    const err = await parseTaskApiError(response, "fallback");

    expect(err.requiresReauth).toBe(false);
    expect(err.message).toBe("session expired");
  });

  it("ignores a non-boolean requiresReauth value", async () => {
    const response = buildResponse(403, {
      error: "weird payload",
      requiresReauth: "yes",
    });

    const err = await parseTaskApiError(response, "fallback");

    expect(err.requiresReauth).toBe(false);
  });

  it("falls back gracefully when the body is not valid JSON", async () => {
    const response = buildResponse(502, null, { jsonThrows: true });

    const err = await parseTaskApiError(response, "Failed to fetch tasks");

    expect(err).toBeInstanceOf(TaskApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Failed to fetch tasks");
    expect(err.requiresReauth).toBe(false);
  });
});
