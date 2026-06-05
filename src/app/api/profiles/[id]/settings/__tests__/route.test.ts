/**
 * Integration tests for /api/profiles/[id]/settings routes
 * Following TDD - tests are written before implementation
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import {
  type ApiErrorResponse,
  createMockRequest,
  createParams,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAdminProfile,
  mockProfileSettings,
  mockUserId,
} from "../../../__tests__/fixtures";
import { GET, PUT } from "../route";

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

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
    },
    profileSettings: {
      upsert: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  profileSettings: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

const profileId = mockAdminProfile.id;

describe("/api/profiles/[id]/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`);
      const response = await GET(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when profile not owned by user", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`);
      const response = await GET(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
      expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
        where: {
          id: profileId,
          userId: mockUserId,
          isActive: true,
        },
        select: { id: true },
      });
    });

    it("returns existing settings for an owned profile (upsert update branch)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      mockPrisma.profileSettings.upsert.mockResolvedValue(mockProfileSettings);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`);
      const response = await GET(request, {
        params: createParams(profileId),
      });
      const { status, data } =
        await parseResponse<typeof mockProfileSettings>(response);

      expect(status).toBe(200);
      expect(data.taskSortOrder).toBe("dueDate");
      expect(data.showCompletedTasks).toBe(false);
      expect(mockPrisma.profileSettings.upsert).toHaveBeenCalledWith({
        where: { profileId },
        create: { profileId },
        update: {},
      });
    });

    it("creates defaults when settings row is missing (upsert create branch)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      // Simulate the upsert's create branch returning a fresh defaults row.
      const freshDefaults = {
        ...mockProfileSettings,
        id: "settings-fresh",
        taskSortOrder: "dueDate",
        showCompletedTasks: false,
        theme: "light",
        language: "en",
        enableNotifications: false,
        notificationTime: null,
        defaultTaskListId: null,
      };
      mockPrisma.profileSettings.upsert.mockResolvedValue(freshDefaults);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`);
      const response = await GET(request, {
        params: createParams(profileId),
      });
      const { status, data } =
        await parseResponse<typeof freshDefaults>(response);

      expect(status).toBe(200);
      expect(data.taskSortOrder).toBe("dueDate");
      expect(data.showCompletedTasks).toBe(false);
      // The upsert call shape proves the create branch will be taken when no
      // row exists — Prisma chooses between create/update based on `where`.
      expect(mockPrisma.profileSettings.upsert).toHaveBeenCalledWith({
        where: { profileId },
        create: { profileId },
        update: {},
      });
    });

    it("returns 404 for a soft-deleted (isActive: false) profile", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // findFirst returns null because the where clause requires
      // `isActive: true` — a soft-deleted profile is intentionally
      // inaccessible. See comment on assertProfileOwnership.
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`);
      const response = await GET(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
      expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
        where: {
          id: profileId,
          userId: mockUserId,
          isActive: true,
        },
        select: { id: true },
      });
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest(`/api/profiles/${profileId}/settings`);
      const response = await GET(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to fetch profile settings");
    });
  });

  describe("PUT", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { taskSortOrder: "title" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when profile not owned by user", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { taskSortOrder: "title" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("updates taskSortOrder successfully", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      const updated = { ...mockProfileSettings, taskSortOrder: "title" };
      mockPrisma.profileSettings.upsert.mockResolvedValue(updated);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { taskSortOrder: "title" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } =
        await parseResponse<typeof mockProfileSettings>(response);

      expect(status).toBe(200);
      expect(data.taskSortOrder).toBe("title");
      expect(mockPrisma.profileSettings.upsert).toHaveBeenCalledWith({
        where: { profileId },
        create: { profileId, taskSortOrder: "title" },
        update: { taskSortOrder: "title" },
      });
    });

    it("updates showCompletedTasks successfully", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      const updated = { ...mockProfileSettings, showCompletedTasks: true };
      mockPrisma.profileSettings.upsert.mockResolvedValue(updated);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { showCompletedTasks: true },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } =
        await parseResponse<typeof mockProfileSettings>(response);

      expect(status).toBe(200);
      expect(data.showCompletedTasks).toBe(true);
    });

    it("rejects invalid taskSortOrder", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { taskSortOrder: "nope" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("taskSortOrder");
      expect(mockPrisma.profileSettings.upsert).not.toHaveBeenCalled();
    });

    it("rejects non-boolean showCompletedTasks", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { showCompletedTasks: "yes" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("showCompletedTasks");
    });

    it("rejects invalid theme", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { theme: "neon" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("theme");
    });

    it("rejects invalid notificationTime", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { notificationTime: "25:99" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("notificationTime");
    });

    it("accepts null notificationTime", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      const updated = { ...mockProfileSettings, notificationTime: null };
      mockPrisma.profileSettings.upsert.mockResolvedValue(updated);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { notificationTime: null },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } =
        await parseResponse<typeof mockProfileSettings>(response);

      expect(status).toBe(200);
      expect(data.notificationTime).toBeNull();
    });

    it("accepts valid notificationTime (HH:MM)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      const updated = {
        ...mockProfileSettings,
        notificationTime: "08:30",
        enableNotifications: true,
      };
      mockPrisma.profileSettings.upsert.mockResolvedValue(updated);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { notificationTime: "08:30", enableNotifications: true },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } =
        await parseResponse<typeof mockProfileSettings>(response);

      expect(status).toBe(200);
      expect(data.notificationTime).toBe("08:30");
      expect(data.enableNotifications).toBe(true);
    });

    it("rejects empty language", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { language: "" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("language");
    });

    it("accepts defaultTaskListId set to null", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      const updated = { ...mockProfileSettings, defaultTaskListId: null };
      mockPrisma.profileSettings.upsert.mockResolvedValue(updated);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { defaultTaskListId: null },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status } =
        await parseResponse<typeof mockProfileSettings>(response);

      expect(status).toBe(200);
    });

    it("rejects an empty body (no valid fields to update)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: {},
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("No valid fields");
      expect(mockPrisma.profileSettings.upsert).not.toHaveBeenCalled();
    });

    it("rejects a body containing only unknown fields (no valid fields to update)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { bogus: "field", id: "evil" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("No valid fields");
      expect(mockPrisma.profileSettings.upsert).not.toHaveBeenCalled();
    });

    it("ignores unknown fields (does not persist them)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      mockPrisma.profileSettings.upsert.mockResolvedValue(mockProfileSettings);

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { taskSortOrder: "title", bogus: "field", id: "evil" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });

      expect(response.status).toBe(200);
      const call = mockPrisma.profileSettings.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ taskSortOrder: "title" });
      expect(call.create).toEqual({
        profileId,
        taskSortOrder: "title",
      });
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({ id: profileId });
      mockPrisma.profileSettings.upsert.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest(`/api/profiles/${profileId}/settings`, {
        method: "PUT",
        body: { taskSortOrder: "title" },
      });
      const response = await PUT(request, {
        params: createParams(profileId),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to update profile settings");
    });
  });
});
