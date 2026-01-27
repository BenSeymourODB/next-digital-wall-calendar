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

    it("creates profile with default values when admin exists", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(1); // Admin already exists
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

    it("creates profile with custom values when admin exists", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(1); // Admin already exists
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
        body: { name: "Admin Profile", type: "admin" }, // Must be admin for first profile
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to create profile");
    });
  });

  describe("first profile admin validation", () => {
    it("returns 400 when first profile is not admin type", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(0); // No existing profiles
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: { name: "Child User", type: "standard" },
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("First profile must be an admin");
    });

    it("returns 400 when first profile uses default type (standard)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(0); // No existing profiles
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const request = createMockRequest("/api/profiles", {
        method: "POST",
        body: { name: "New User" }, // No type specified, defaults to standard
      });

      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("First profile must be an admin");
    });

    it("creates first profile successfully when type is admin", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(0); // No existing profiles
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const createdProfile = {
        id: "first-admin-id",
        userId: mockSession.user.id,
        name: "Admin User",
        type: "admin",
        ageGroup: "adult",
        color: "#3b82f6",
        avatar: { type: "initials", value: "AD", backgroundColor: "#3b82f6" },
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
        body: { name: "Admin User", type: "admin" },
      });

      const response = await POST(request);
      const { status, data } =
        await parseResponse<typeof createdProfile>(response);

      expect(status).toBe(201);
      expect(data.name).toBe("Admin User");
      expect(data.type).toBe("admin");
    });

    it("allows creating standard profile after admin exists", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(1); // One profile already exists
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const createdProfile = {
        id: "standard-profile-id",
        userId: mockSession.user.id,
        name: "Child User",
        type: "standard",
        ageGroup: "child",
        color: "#22c55e",
        avatar: { type: "initials", value: "CH", backgroundColor: "#22c55e" },
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
        body: { name: "Child User", type: "standard" },
      });

      const response = await POST(request);
      const { status, data } =
        await parseResponse<typeof createdProfile>(response);

      expect(status).toBe(201);
      expect(data.name).toBe("Child User");
      expect(data.type).toBe("standard");
    });
  });

  describe("multiple admin profiles", () => {
    it("allows creating second admin profile", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(1); // One admin already exists
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const createdProfile = {
        id: "second-admin-id",
        userId: mockSession.user.id,
        name: "Second Admin",
        type: "admin",
        ageGroup: "adult",
        color: "#ef4444",
        avatar: { type: "initials", value: "SA", backgroundColor: "#ef4444" },
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
        body: { name: "Second Admin", type: "admin" },
      });

      const response = await POST(request);
      const { status, data } =
        await parseResponse<typeof createdProfile>(response);

      expect(status).toBe(201);
      expect(data.name).toBe("Second Admin");
      expect(data.type).toBe("admin");
    });

    it("allows creating third admin profile", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.count.mockResolvedValue(2); // Two profiles already exist
      mockPrisma.user.findUnique.mockResolvedValue({ maxProfiles: 10 });

      const createdProfile = {
        id: "third-admin-id",
        userId: mockSession.user.id,
        name: "Third Admin",
        type: "admin",
        ageGroup: "adult",
        color: "#8b5cf6",
        avatar: { type: "initials", value: "TA", backgroundColor: "#8b5cf6" },
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
        body: { name: "Third Admin", type: "admin" },
      });

      const response = await POST(request);
      const { status, data } =
        await parseResponse<typeof createdProfile>(response);

      expect(status).toBe(201);
      expect(data.name).toBe("Third Admin");
      expect(data.type).toBe("admin");
    });
  });
});
