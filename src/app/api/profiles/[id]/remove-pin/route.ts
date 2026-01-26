/**
 * API route for removing profile PIN
 * POST /api/profiles/[id]/remove-pin - Remove PIN from a profile
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";

/**
 * Request body for removing PIN
 */
interface RemovePinBody {
  currentPin: string;
}

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/profiles/[id]/remove-pin - Remove PIN from a profile
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as RemovePinBody;
    const { currentPin } = body;

    // Validate currentPin is provided
    if (!currentPin) {
      return NextResponse.json(
        { error: "Current PIN required" },
        { status: 400 }
      );
    }

    // Get profile
    const profile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Admin profiles cannot remove PIN (security requirement)
    if (profile.type === "admin") {
      return NextResponse.json(
        { error: "Admin profiles cannot remove PIN" },
        { status: 403 }
      );
    }

    // Check if profile has a PIN to remove
    if (!profile.pinEnabled || !profile.pinHash) {
      return NextResponse.json(
        { error: "Profile does not have a PIN" },
        { status: 400 }
      );
    }

    // Verify current PIN
    const isValid = await bcrypt.compare(currentPin, profile.pinHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current PIN is incorrect" },
        { status: 401 }
      );
    }

    // Remove PIN and reset lockout fields
    await prisma.profile.update({
      where: { id },
      data: {
        pinHash: null,
        pinEnabled: false,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    logger.event("ProfilePinRemoved", {
      userId: session.user.id,
      profileId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}/remove-pin`,
      method: "POST",
    });

    return NextResponse.json(
      { error: "Failed to remove PIN" },
      { status: 500 }
    );
  }
}
