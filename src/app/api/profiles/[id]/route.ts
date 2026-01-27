/**
 * API routes for individual profile operations
 * GET /api/profiles/[id] - Get a specific profile
 * PATCH /api/profiles/[id] - Update a profile
 * DELETE /api/profiles/[id] - Soft delete a profile
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * Profile avatar type
 */
interface ProfileAvatar {
  type: "initials" | "photo" | "emoji";
  value: string;
  backgroundColor?: string;
}

/**
 * Update profile request body
 */
interface UpdateProfileBody {
  name?: string;
  type?: "admin" | "standard";
  ageGroup?: "adult" | "teen" | "child";
  color?: string;
  avatar?: ProfileAvatar;
}

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/profiles/[id] - Get a specific profile
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const profile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
        settings: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}`,
      method: "GET",
    });

    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profiles/[id] - Update a profile
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as UpdateProfileBody;
    const { name, color, avatar, type, ageGroup } = body;

    // Verify ownership
    const existingProfile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (type !== undefined) updateData.type = type;
    if (ageGroup !== undefined) updateData.ageGroup = ageGroup;

    // Update profile
    const profile = await prisma.profile.update({
      where: { id },
      data: updateData,
      include: {
        rewardPoints: true,
        settings: true,
      },
    });

    logger.event("ProfileUpdated", {
      profileId: profile.id,
      userId: session.user.id,
    });

    return NextResponse.json(profile);
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}`,
      method: "PATCH",
    });

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profiles/[id] - Soft delete a profile
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Soft delete (set isActive = false)
    const result = await prisma.profile.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    logger.event("ProfileDeleted", {
      profileId: id,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}`,
      method: "DELETE",
    });

    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 }
    );
  }
}
