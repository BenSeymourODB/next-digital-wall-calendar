/**
 * API route for resetting profile PIN (admin-only)
 * POST /api/profiles/[id]/reset-pin - Reset PIN for a profile (admin action)
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";

/**
 * Request body for resetting PIN
 */
interface ResetPinBody {
  adminProfileId: string;
  adminPin: string;
  newPin: string;
}

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/profiles/[id]/reset-pin - Reset PIN for a profile (admin action)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as ResetPinBody;
    const { adminProfileId, adminPin, newPin } = body;

    // Validate required fields
    if (!adminProfileId || !adminPin || !newPin) {
      return NextResponse.json(
        { error: "Admin profile ID, admin PIN, and new PIN required" },
        { status: 400 }
      );
    }

    // Validate new PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(newPin)) {
      return NextResponse.json(
        { error: "New PIN must be 4-6 digits" },
        { status: 400 }
      );
    }

    // Get admin profile
    const adminProfile = await prisma.profile.findFirst({
      where: {
        id: adminProfileId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    // Verify admin type
    if (adminProfile.type !== "admin") {
      return NextResponse.json(
        { error: "Only admin profiles can reset PINs" },
        { status: 403 }
      );
    }

    // Verify admin's PIN
    if (!adminProfile.pinHash) {
      return NextResponse.json(
        { error: "Admin PIN is incorrect" },
        { status: 401 }
      );
    }

    const isAdminPinValid = await bcrypt.compare(
      adminPin,
      adminProfile.pinHash
    );
    if (!isAdminPinValid) {
      return NextResponse.json(
        { error: "Admin PIN is incorrect" },
        { status: 401 }
      );
    }

    // Get target profile
    const targetProfile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Target profile not found" },
        { status: 404 }
      );
    }

    // Cannot reset another admin's PIN (only your own)
    if (targetProfile.type === "admin" && targetProfile.id !== adminProfileId) {
      return NextResponse.json(
        { error: "Cannot reset another admin's PIN" },
        { status: 403 }
      );
    }

    // Hash new PIN (bcrypt salt rounds: 10)
    const pinHash = await bcrypt.hash(newPin, 10);

    // Update target profile's PIN and reset lockout fields
    await prisma.profile.update({
      where: { id },
      data: {
        pinHash,
        pinEnabled: true,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    logger.event("ProfilePinReset", {
      userId: session.user.id,
      adminProfileId,
      targetProfileId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}/reset-pin`,
      method: "POST",
    });

    return NextResponse.json({ error: "Failed to reset PIN" }, { status: 500 });
  }
}
