/**
 * API routes for profile management
 * GET /api/profiles - List all profiles for authenticated user
 * POST /api/profiles - Create a new profile
 */
import {
  ApiError,
  requireUserSession,
  withApiHandler,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * Profile avatar type - uses index signature for Prisma JSON compatibility
 */
type ProfileAvatar = {
  type: "initials" | "photo" | "emoji";
  value: string;
  backgroundColor?: string;
  [key: string]: string | undefined;
};

/**
 * Create profile request body
 */
interface CreateProfileBody {
  name: string;
  type?: "admin" | "standard";
  ageGroup?: "adult" | "teen" | "child";
  color?: string;
  avatar?: ProfileAvatar;
}

/**
 * GET /api/profiles - List all profiles for authenticated user
 */
export const GET = withApiHandler(
  {
    endpoint: "/api/profiles",
    method: "GET",
    errorMessage: "Failed to fetch profiles",
  },
  async () => {
    const session = await requireUserSession();

    const profiles = await prisma.profile.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(profiles);
  }
);

/**
 * POST /api/profiles - Create a new profile
 */
export const POST = withApiHandler(
  {
    endpoint: "/api/profiles",
    method: "POST",
    errorMessage: "Failed to create profile",
  },
  async (request: NextRequest) => {
    const session = await requireUserSession();

    const body = (await request.json()) as CreateProfileBody;
    const {
      name,
      type = "standard",
      ageGroup = "adult",
      color = "#3b82f6",
      avatar,
    } = body;

    if (!name || name.trim().length === 0) {
      throw new ApiError("Name is required", 400);
    }

    const existingCount = await prisma.profile.count({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    // First profile must be admin
    if (existingCount === 0 && type !== "admin") {
      throw new ApiError("First profile must be an admin", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { maxProfiles: true },
    });

    const maxProfiles = user?.maxProfiles ?? 10;

    if (existingCount >= maxProfiles) {
      throw new ApiError("Profile limit reached", 400);
    }

    const defaultAvatar: ProfileAvatar = avatar ?? {
      type: "initials",
      value: name.substring(0, 2).toUpperCase(),
      backgroundColor: color,
    };

    const profile = await prisma.profile.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        type,
        ageGroup,
        color,
        avatar: defaultAvatar,
        rewardPoints: {
          create: {
            totalPoints: 0,
          },
        },
        settings: {
          create: {
            showCompletedTasks: false,
            taskSortOrder: "dueDate",
            theme: "light",
            language: "en",
          },
        },
      },
      include: {
        rewardPoints: true,
        settings: true,
      },
    });

    logger.event("ProfileCreated", {
      profileId: profile.id,
      userId: session.user.id,
      name: profile.name,
      type: profile.type,
    });

    return NextResponse.json(profile, { status: 201 });
  }
);
