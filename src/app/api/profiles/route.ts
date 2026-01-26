/**
 * API routes for profile management
 * GET /api/profiles - List all profiles for authenticated user
 * POST /api/profiles - Create a new profile
 */
import { getSession } from "@/lib/auth";
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
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/profiles",
      method: "GET",
    });

    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profiles - Create a new profile
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateProfileBody;
    const {
      name,
      type = "standard",
      ageGroup = "adult",
      color = "#3b82f6",
      avatar,
    } = body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check profile limit
    const existingCount = await prisma.profile.count({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { maxProfiles: true },
    });

    const maxProfiles = user?.maxProfiles ?? 10;

    if (existingCount >= maxProfiles) {
      return NextResponse.json(
        { error: "Profile limit reached" },
        { status: 400 }
      );
    }

    // Generate default avatar if not provided
    const defaultAvatar: ProfileAvatar = avatar ?? {
      type: "initials",
      value: name.substring(0, 2).toUpperCase(),
      backgroundColor: color,
    };

    // Create profile with reward points and settings
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
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/profiles",
      method: "POST",
    });

    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
