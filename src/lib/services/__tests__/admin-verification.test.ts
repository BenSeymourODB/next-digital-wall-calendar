/**
 * Unit tests for the admin-verification service.
 *
 * Tests the admin lookup + PIN check in isolation with two mocks
 * (prisma + bcrypt). No auth, no NextRequest, no logger.
 */
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAdminProfile,
  mockStandardProfile,
  mockUserId,
} from "../../../app/api/profiles/__tests__/fixtures";
import { verifyAdminWithPin } from "../admin-verification";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const adminWithHash = {
  ...mockAdminProfile,
  pinEnabled: true,
  pinHash: "$2b$10$adminHash",
};

describe("verifyAdminWithPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the admin profile when lookup + PIN both succeed", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(adminWithHash);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await verifyAdminWithPin(
      mockUserId,
      mockAdminProfile.id,
      "1234"
    );

    expect(result).toEqual({ success: true, adminProfile: adminWithHash });
  });

  it("scopes the lookup to the caller's userId, the given profile id, and active profiles", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(adminWithHash);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await verifyAdminWithPin(mockUserId, mockAdminProfile.id, "1234");

    expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: mockAdminProfile.id,
          userId: mockUserId,
          isActive: true,
        },
      })
    );
  });

  it("compares the supplied PIN against the stored hash", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(adminWithHash);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await verifyAdminWithPin(mockUserId, mockAdminProfile.id, "1234");

    expect(bcrypt.compare).toHaveBeenCalledWith("1234", "$2b$10$adminHash");
  });

  it("returns 404 when the admin profile is not found", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(null);

    const result = await verifyAdminWithPin(mockUserId, "missing-id", "1234");

    expect(result).toEqual({
      success: false,
      error: "Admin profile not found",
      status: 404,
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns 403 when the profile is not an admin", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      ...mockStandardProfile,
      pinEnabled: true,
      pinHash: "$2b$10$standardHash",
    });

    const result = await verifyAdminWithPin(
      mockUserId,
      mockStandardProfile.id,
      "1234"
    );

    expect(result).toEqual({
      success: false,
      error: "This action requires an admin profile",
      status: 403,
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns 401 when the admin profile has no PIN hash set", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      ...mockAdminProfile,
      pinEnabled: false,
      pinHash: null,
    });

    const result = await verifyAdminWithPin(
      mockUserId,
      mockAdminProfile.id,
      "1234"
    );

    expect(result).toEqual({
      success: false,
      error: "Admin PIN is incorrect",
      status: 401,
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns 401 when bcrypt.compare returns false", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(adminWithHash);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const result = await verifyAdminWithPin(
      mockUserId,
      mockAdminProfile.id,
      "0000"
    );

    expect(result).toEqual({
      success: false,
      error: "Admin PIN is incorrect",
      status: 401,
    });
  });

  it("propagates errors from prisma rather than swallowing them", async () => {
    mockPrisma.profile.findFirst.mockRejectedValue(new Error("db down"));

    await expect(
      verifyAdminWithPin(mockUserId, mockAdminProfile.id, "1234")
    ).rejects.toThrow("db down");
  });
});
