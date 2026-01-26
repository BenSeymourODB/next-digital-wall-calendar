/**
 * API route for verifying profile PIN
 * POST /api/profiles/[id]/verify-pin - Verify PIN for profile switching
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";

/**
 * Request body for verifying PIN
 */
interface VerifyPinBody {
  pin: string;
}

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

// Lockout duration in milliseconds (5 minutes)
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

// Maximum failed attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;

/**
 * POST /api/profiles/[id]/verify-pin - Verify PIN for profile switching
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as VerifyPinBody;
    const { pin } = body;

    if (!pin) {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
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

    // Check if profile is locked
    if (profile.pinLockedUntil && profile.pinLockedUntil > new Date()) {
      const remainingSeconds = Math.ceil(
        (profile.pinLockedUntil.getTime() - Date.now()) / 1000
      );

      return NextResponse.json(
        {
          error: "Profile locked due to too many failed attempts",
          lockedFor: remainingSeconds,
        },
        { status: 429 }
      );
    }

    // Check if PIN is set
    if (!profile.pinEnabled || !profile.pinHash) {
      return NextResponse.json({ success: true }); // No PIN required
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, profile.pinHash);

    if (isValid) {
      // Reset failed attempts
      await prisma.profile.update({
        where: { id },
        data: {
          failedPinAttempts: 0,
          pinLockedUntil: null,
        },
      });

      logger.event("ProfilePinVerified", {
        userId: session.user.id,
        profileId: id,
      });

      return NextResponse.json({ success: true });
    } else {
      // Increment failed attempts
      const failedAttempts = profile.failedPinAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
      const pinLockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;

      await prisma.profile.update({
        where: { id },
        data: {
          failedPinAttempts: failedAttempts,
          pinLockedUntil,
        },
      });

      logger.event("ProfilePinFailed", {
        userId: session.user.id,
        profileId: id,
        failedAttempts,
        locked: shouldLock,
      });

      return NextResponse.json(
        {
          error: "Incorrect PIN",
          attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
          locked: shouldLock,
        },
        { status: 401 }
      );
    }
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}/verify-pin`,
      method: "POST",
    });

    return NextResponse.json(
      { error: "Failed to verify PIN" },
      { status: 500 }
    );
  }
}
