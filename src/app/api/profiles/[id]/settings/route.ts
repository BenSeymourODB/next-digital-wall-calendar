/**
 * API routes for profile-scoped settings.
 *
 * GET  /api/profiles/[id]/settings — fetch the ProfileSettings row for a
 *                                    profile owned by the authenticated user,
 *                                    upserting defaults when absent.
 * PUT  /api/profiles/[id]/settings — partial update of the same row.
 *
 * Active profile is a client-side concept (see ProfileContext). This endpoint
 * is explicit about which profile is being addressed so it can also serve
 * `TasksSettingsPanel` (#333) without coupling to server-side active state.
 */
import {
  ApiError,
  requireUserSession,
  withApiHandler,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_TASK_SORT_ORDERS = ["dueDate", "title", "priority", "createdAt"];
const VALID_THEMES = ["light", "dark", "auto", "system"];
const NOTIFICATION_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type SettingsUpdate = {
  taskSortOrder?: string;
  showCompletedTasks?: boolean;
  theme?: string;
  language?: string;
  enableNotifications?: boolean;
  notificationTime?: string | null;
  defaultTaskListId?: string | null;
};

function validateAndExtract(body: Record<string, unknown>): SettingsUpdate {
  const update: SettingsUpdate = {};

  if (body.taskSortOrder !== undefined) {
    if (
      typeof body.taskSortOrder !== "string" ||
      !VALID_TASK_SORT_ORDERS.includes(body.taskSortOrder)
    ) {
      throw new ApiError(
        `Invalid taskSortOrder. Must be one of: ${VALID_TASK_SORT_ORDERS.join(", ")}`,
        400
      );
    }
    update.taskSortOrder = body.taskSortOrder;
  }

  if (body.showCompletedTasks !== undefined) {
    if (typeof body.showCompletedTasks !== "boolean") {
      throw new ApiError("showCompletedTasks must be a boolean", 400);
    }
    update.showCompletedTasks = body.showCompletedTasks;
  }

  if (body.theme !== undefined) {
    if (typeof body.theme !== "string" || !VALID_THEMES.includes(body.theme)) {
      throw new ApiError(
        `Invalid theme. Must be one of: ${VALID_THEMES.join(", ")}`,
        400
      );
    }
    update.theme = body.theme;
  }

  if (body.language !== undefined) {
    if (typeof body.language !== "string" || body.language.length === 0) {
      throw new ApiError("language must be a non-empty string", 400);
    }
    update.language = body.language;
  }

  if (body.enableNotifications !== undefined) {
    if (typeof body.enableNotifications !== "boolean") {
      throw new ApiError("enableNotifications must be a boolean", 400);
    }
    update.enableNotifications = body.enableNotifications;
  }

  if (body.notificationTime !== undefined) {
    if (body.notificationTime === null) {
      update.notificationTime = null;
    } else if (
      typeof body.notificationTime !== "string" ||
      !NOTIFICATION_TIME_RE.test(body.notificationTime)
    ) {
      throw new ApiError("notificationTime must be HH:MM or null", 400);
    } else {
      update.notificationTime = body.notificationTime;
    }
  }

  if (body.defaultTaskListId !== undefined) {
    if (
      body.defaultTaskListId !== null &&
      typeof body.defaultTaskListId !== "string"
    ) {
      throw new ApiError("defaultTaskListId must be a string or null", 400);
    }
    update.defaultTaskListId = body.defaultTaskListId as string | null;
  }

  return update;
}

async function assertProfileOwnership(
  profileId: string,
  userId: string
): Promise<void> {
  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      userId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!profile) {
    throw new ApiError("Profile not found", 404);
  }
}

export const GET = withApiHandler(
  {
    endpoint: "/api/profiles/[id]/settings",
    method: "GET",
    errorMessage: "Failed to fetch profile settings",
  },
  async (_request: NextRequest, { params }: RouteParams) => {
    const session = await requireUserSession();
    const { id: profileId } = await params;

    await assertProfileOwnership(profileId, session.user.id);

    const settings = await prisma.profileSettings.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });

    return NextResponse.json(settings);
  }
);

export const PUT = withApiHandler(
  {
    endpoint: "/api/profiles/[id]/settings",
    method: "PUT",
    errorMessage: "Failed to update profile settings",
  },
  async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireUserSession();
    const { id: profileId } = await params;

    await assertProfileOwnership(profileId, session.user.id);

    const body = (await request.json()) as Record<string, unknown>;
    const update = validateAndExtract(body);

    const settings = await prisma.profileSettings.upsert({
      where: { profileId },
      create: { profileId, ...update },
      update,
    });

    logger.event("ProfileSettingsUpdated", {
      profileId,
      userId: session.user.id,
      fields: Object.keys(update).join(","),
    });

    return NextResponse.json(settings);
  }
);
