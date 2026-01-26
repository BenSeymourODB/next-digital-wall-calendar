/**
 * Integration tests for /api/profiles/[id] routes
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAdminProfile,
  mockProfileRewardPoints,
  mockProfileSettings,
  mockStandardProfile,
} from "../../__tests__/fixtures";
// Import route handlers and db after mocks are set up
import { DELETE, GET, PATCH } from "../route";

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

// Mock Prisma client - must be inline within the factory
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

// Helper to create params promise (Next.js 16 style)
function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("/api/profiles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/profiles/[id]", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1");
      const response = await GET(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/nonexistent");
      const response = await GET(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("returns profile with relations", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      const profileWithRelations = {
        ...mockAdminProfile,
        rewardPoints: mockProfileRewardPoints,
        settings: mockProfileSettings,
      };
      mockPrisma.profile.findFirst.mockResolvedValue(profileWithRelations);

      const request = createMockRequest(`/api/profiles/${mockAdminProfile.id}`);
      const response = await GET(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } =
        await parseResponse<typeof profileWithRelations>(response);

      expect(status).toBe(200);
      expect(data.id).toBe(mockAdminProfile.id);
      expect(data.name).toBe(mockAdminProfile.name);
      expect(data.rewardPoints).toBeDefined();
      expect(data.settings).toBeDefined();
    });

    it("only returns profiles owned by the user", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(mockAdminProfile);

      const request = createMockRequest(`/api/profiles/${mockAdminProfile.id}`);
      await GET(request, { params: createParams(mockAdminProfile.id) });

      expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockAdminProfile.id,
            userId: mockSession.user.id,
            isActive: true,
          }),
        })
      );
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/profiles/profile-1");
      const response = await GET(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to fetch profile");
    });
  });

  describe("PATCH /api/profiles/[id]", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1", {
        method: "PATCH",
        body: { name: "Updated Name" },
      });
      const response = await PATCH(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/nonexistent", {
        method: "PATCH",
        body: { name: "Updated Name" },
      });
      const response = await PATCH(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("updates profile name", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(mockStandardProfile);

      const updatedProfile = { ...mockStandardProfile, name: "Updated Name" };
      mockPrisma.profile.update.mockResolvedValue(updatedProfile);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}`,
        {
          method: "PATCH",
          body: { name: "Updated Name" },
        }
      );
      const response = await PATCH(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } =
        await parseResponse<typeof updatedProfile>(response);

      expect(status).toBe(200);
      expect(data.name).toBe("Updated Name");
    });

    it("updates profile color", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(mockStandardProfile);

      const updatedProfile = { ...mockStandardProfile, color: "#ef4444" };
      mockPrisma.profile.update.mockResolvedValue(updatedProfile);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}`,
        {
          method: "PATCH",
          body: { color: "#ef4444" },
        }
      );
      const response = await PATCH(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } =
        await parseResponse<typeof updatedProfile>(response);

      expect(status).toBe(200);
      expect(data.color).toBe("#ef4444");
    });

    it("updates profile avatar", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(mockStandardProfile);

      const newAvatar = { type: "emoji", value: "🎮" };
      const updatedProfile = { ...mockStandardProfile, avatar: newAvatar };
      mockPrisma.profile.update.mockResolvedValue(updatedProfile);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}`,
        {
          method: "PATCH",
          body: { avatar: newAvatar },
        }
      );
      const response = await PATCH(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } =
        await parseResponse<typeof updatedProfile>(response);

      expect(status).toBe(200);
      expect(data.avatar).toEqual(newAvatar);
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(mockStandardProfile);
      mockPrisma.profile.update.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("/api/profiles/profile-1", {
        method: "PATCH",
        body: { name: "Updated" },
      });
      const response = await PATCH(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to update profile");
    });
  });

  describe("DELETE /api/profiles/[id]", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1", {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.updateMany.mockResolvedValue({ count: 0 });

      const request = createMockRequest("/api/profiles/nonexistent", {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("soft deletes profile (sets isActive to false)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.updateMany.mockResolvedValue({ count: 1 });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}`,
        {
          method: "DELETE",
        }
      );
      const response = await DELETE(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<{ success: boolean }>(
        response
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      expect(mockPrisma.profile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mockStandardProfile.id,
            userId: mockSession.user.id,
          },
          data: {
            isActive: false,
          },
        })
      );
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.updateMany.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/profiles/profile-1", {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to delete profile");
    });
  });
});
