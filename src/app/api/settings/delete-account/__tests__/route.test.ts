/**
 * Integration tests for /api/settings/delete-account route
 * Following TDD - tests are written before implementation
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import {
  type ApiErrorResponse,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "../route";

// Mock modules BEFORE imports
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

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      delete: vi.fn(),
    },
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  user: {
    delete: ReturnType<typeof vi.fn>;
  };
};

describe("/api/settings/delete-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DELETE /api/settings/delete-account", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const response = await DELETE();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("deletes user and all related data", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.user.delete.mockResolvedValue({ id: mockSession.user.id });

      const response = await DELETE();
      const { status, data } = await parseResponse<{ success: boolean }>(
        response
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockSession.user.id },
      });
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.user.delete.mockRejectedValue(new Error("Database error"));

      const response = await DELETE();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to delete account");
    });
  });
});
