/**
 * API route for setting profile PIN
 * POST /api/profiles/[id]/set-pin - Set or update PIN for a profile
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";

/**
 * Request body for setting PIN
 */
interface SetPinBody {
  pin: string;
  currentPin?: string;
}

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/profiles/[id]/set-pin - Set or update PIN for a profile
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as SetPinBody;
    const { pin, currentPin } = body;

    // Validate PIN format (4-6 digits)
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4-6 digits" },
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

    // If profile already has a PIN, verify current PIN
    if (profile.pinEnabled && profile.pinHash) {
      if (!currentPin) {
        return NextResponse.json(
          { error: "Current PIN required" },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(currentPin, profile.pinHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Current PIN is incorrect" },
          { status: 401 }
        );
      }
    }

    // Hash new PIN (bcrypt salt rounds: 10)
    const pinHash = await bcrypt.hash(pin, 10);

    // Update profile
    await prisma.profile.update({
      where: { id },
      data: {
        pinHash,
        pinEnabled: true,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    logger.event("ProfilePinSet", {
      userId: session.user.id,
      profileId: id,
      isUpdate: profile.pinEnabled,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}/set-pin`,
      method: "POST",
    });

    return NextResponse.json({ error: "Failed to set PIN" }, { status: 500 });
  }
}
