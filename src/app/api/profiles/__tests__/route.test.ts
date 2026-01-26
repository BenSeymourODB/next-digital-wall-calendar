/**
 * Integration tests for /api/profiles routes
 * Following TDD - tests are written before implementation
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
// Import route handlers and db after mocks are set up
import { GET, POST } from "../route";
import {
  mockAdminProfile,
  mockCreateProfileInput,
  mockProfileList,
  mockProfileRewardPoints,
  mockProfileSettings,
} from "./fixtures";

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
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  profile: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe("/api/profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/profiles", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns empty array when user has no profiles", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findMany.mockResolvedValue([]);

      const response = await GET();
      const { status, data } = await parseResponse<unknown[]>(response);

      expect(status).toBe(200);
      expect(data).toEqual([]);
    });

    it("returns list of profiles for authenticated user", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findMany.mockResolvedValue(mockProfileList);

      const response = await GET();
      const { status, data } = await parseResponse<unknown[]>(response);

      expect(status).toBe(200);
      expect(data).toHaveLength(3);
      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockSession.user.id,
            isActive: true,
          },
        })
      );
    });

    it("only returns active profiles", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findMany.mockResolvedValue([mockAdminProfile]);

      const response = await GET();
      const { status } = await parseResponse<unknown[]>(response);

      expect(status).toBe(200);
      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findMany.mockRejectedValue(
        new Error("Database error")
      );

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to fetch profiles");
    });
  });

  describe("POST /api/profiles", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: mockCreateProfileInput,
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 when name is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: { type: "standard" }, // Missing name
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when profile limit reached", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(10);
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: mockCreateProfileInput,
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Profile limit reached");
    });

    it("creates profile with default values", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const createdProfile = {
        id: "new-profile-id",
        userId: mockSession.user.id,
        name: "New Profile",
        type: "standard",
        ageGroup: "adult",
        color: "#3b82f6",
        avatar: { type: "initials", value: "NE", backgroundColor: "#3b82f6" },
        pinHash: null,
        pinEnabled: false,
        failedPinAttempts: 0,
        pinLockedUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rewardPoints: mockProfileRewardPoints,
        settings: mockProfileSettings,
      };

      mockPrisma.profile.create.mockResolvedValue(createdProfile);

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: { name: "New Profile" },
      });

      const response = await POST(request);
      const { status, data } =
        await parseResponse<typeof createdProfile>(response);

      expect(status).toBe(201);
      expect(data.name).toBe("New Profile");
      expect(data.type).toBe("standard"); // Default type
    });

    it("creates profile with custom values", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const createdProfile = {
        ...mockAdminProfile,
        ...mockCreateProfileInput,
        id: "new-profile-id",
        userId: mockSession.user.id,
        rewardPoints: mockProfileRewardPoints,
        settings: mockProfileSettings,
      };

      mockPrisma.profile.create.mockResolvedValue(createdProfile);

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: mockCreateProfileInput,
      });

      const response = await POST(request);
      const { status, data } =
        await parseResponse<typeof createdProfile>(response);

      expect(status).toBe(201);
      expect(data.name).toBe(mockCreateProfileInput.name);
      expect(data.color).toBe(mockCreateProfileInput.color);
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });
      mockPrisma.profile.create.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: mockCreateProfileInput,
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to create profile");
    });
  });
});
