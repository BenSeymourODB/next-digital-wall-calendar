/**
 * Admin verification service.
 *
 * Encapsulates the "look up an admin profile and verify its PIN" check
 * so admin-gated route handlers only have to deal with auth, request
 * parsing, and response shaping.
 */
import type { Profile } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

export type AdminVerificationResult =
  | { success: true; adminProfile: Profile }
  | { success: false; error: string; status: number };

/**
 * Verify that `adminProfileId` belongs to the calling user, is an admin,
 * and that `adminPin` matches the stored bcrypt hash.
 *
 * On failure the result carries both an error message and the HTTP
 * status the route should return, so callers can forward it directly
 * to `NextResponse.json`.
 */
export async function verifyAdminWithPin(
  userId: string,
  adminProfileId: string,
  adminPin: string
): Promise<AdminVerificationResult> {
  const adminProfile = await prisma.profile.findFirst({
    where: {
      id: adminProfileId,
      userId,
      isActive: true,
    },
  });

  if (!adminProfile) {
    return {
      success: false,
      error: "Admin profile not found",
      status: 404,
    };
  }

  if (adminProfile.type !== "admin") {
    return {
      success: false,
      error: "This action requires an admin profile",
      status: 403,
    };
  }

  if (!adminProfile.pinHash) {
    return {
      success: false,
      error: "Admin PIN is incorrect",
      status: 401,
    };
  }

  const isValid = await bcrypt.compare(adminPin, adminProfile.pinHash);
  if (!isValid) {
    return {
      success: false,
      error: "Admin PIN is incorrect",
      status: 401,
    };
  }

  return { success: true, adminProfile };
}
