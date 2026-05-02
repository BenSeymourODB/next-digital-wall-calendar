import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { logger } from "@/lib/logger";
import {
  type ApiErrorResponse,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, requireUserSession, withApiHandler } from "../handler";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

describe("ApiError", () => {
  it("preserves message and status", () => {
    const err = new ApiError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
  });

  it("is an instance of Error", () => {
    const err = new ApiError("Boom", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it("has a stable name for instanceof failures across realms", () => {
    const err = new ApiError("Bad request", 400);
    expect(err.name).toBe("ApiError");
  });
});

describe("requireUserSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the session when authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const session = await requireUserSession();

    expect(session.user.id).toBe(mockSession.user.id);
  });

  it("throws ApiError(401) when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    await expect(requireUserSession()).rejects.toMatchObject({
      message: "Unauthorized",
      status: 401,
    });
  });

  it("throws ApiError(401) when session has no user id", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { name: "noid" },
      expires: new Date().toISOString(),
    } as never);

    await expect(requireUserSession()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("withApiHandler", () => {
  const options = {
    endpoint: "/api/test",
    method: "GET",
    errorMessage: "Failed to test",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the handler's response on success", async () => {
    const wrapped = withApiHandler(options, async () =>
      NextResponse.json({ ok: true }, { status: 200 })
    );

    const response = await wrapped();
    const { status, data } = await parseResponse<{ ok: boolean }>(response);

    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("forwards arguments to the handler", async () => {
    const handler = vi.fn(async (greeting: string, count: number) =>
      NextResponse.json({ greeting, count })
    );
    const wrapped = withApiHandler(options, handler);

    const response = await wrapped("hello", 42);
    const { data } = await parseResponse<{ greeting: string; count: number }>(
      response
    );

    expect(handler).toHaveBeenCalledWith("hello", 42);
    expect(data).toEqual({ greeting: "hello", count: 42 });
  });

  it("renders ApiError as a JSON response with its status and message", async () => {
    const wrapped = withApiHandler(options, async () => {
      throw new ApiError("Profile not found", 404);
    });

    const response = await wrapped();
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(404);
    expect(data.error).toBe("Profile not found");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs unknown errors and returns a 500 with the configured message", async () => {
    const boom = new Error("kaboom");
    const wrapped = withApiHandler(options, async () => {
      throw boom;
    });

    const response = await wrapped();
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Failed to test");
    expect(logger.error).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        endpoint: "/api/test",
        method: "GET",
      })
    );
  });

  it("logs and 500s on non-Error throws", async () => {
    const wrapped = withApiHandler(options, async () => {
      throw "string-thrown";
    });

    const response = await wrapped();
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Failed to test");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("composes with requireUserSession to produce the standard 401 response", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const wrapped = withApiHandler(options, async () => {
      const session = await requireUserSession();
      return NextResponse.json({ id: session.user.id });
    });

    const response = await wrapped();
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
