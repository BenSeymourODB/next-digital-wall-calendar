/**
 * API routes for individual profile operations
 * GET /api/profiles/[id] - Get a specific profile
 * PATCH /api/profiles/[id] - Update a profile
 * DELETE /api/profiles/[id] - Soft delete a profile
 */
import {
  ApiError,
  requireUserSession,
  withApiHandler,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

interface ProfileAvatar {
  type: "initials" | "photo" | "emoji";
  value: string;
  backgroundColor?: string;
}

interface UpdateProfileBody {
  name?: string;
  type?: "admin" | "standard";
  ageGroup?: "adult" | "teen" | "child";
  color?: string;
  avatar?: ProfileAvatar;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/profiles/[id] - Get a specific profile
 */
export const GET = withApiHandler(
  {
    endpoint: "/api/profiles/[id]",
    method: "GET",
    errorMessage: "Failed to fetch profile",
  },
  async (_request: NextRequest, { params }: RouteParams) => {
    const session = await requireUserSession();
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
      throw new ApiError("Profile not found", 404);
    }

    return NextResponse.json(profile);
  }
);

/**
 * PATCH /api/profiles/[id] - Update a profile
 */
export const PATCH = withApiHandler(
  {
    endpoint: "/api/profiles/[id]",
    method: "PATCH",
    errorMessage: "Failed to update profile",
  },
  async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireUserSession();
    const { id } = await params;
    const body = (await request.json()) as UpdateProfileBody;
    const { name, color, avatar, type, ageGroup } = body;

    const existingProfile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingProfile) {
      throw new ApiError("Profile not found", 404);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (type !== undefined) updateData.type = type;
    if (ageGroup !== undefined) updateData.ageGroup = ageGroup;

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
  }
);

/**
 * DELETE /api/profiles/[id] - Soft delete a profile
 */
export const DELETE = withApiHandler(
  {
    endpoint: "/api/profiles/[id]",
    method: "DELETE",
    errorMessage: "Failed to delete profile",
  },
  async (_request: NextRequest, { params }: RouteParams) => {
    const session = await requireUserSession();
    const { id } = await params;

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
      throw new ApiError("Profile not found", 404);
    }

    logger.event("ProfileDeleted", {
      profileId: id,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  }
);
