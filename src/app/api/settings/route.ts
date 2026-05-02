import {
  ApiError,
  requireUserSession,
  withApiHandler,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const VALID_THEMES = ["light", "dark", "auto", "system"];
const VALID_TIME_FORMATS = ["12h", "24h"];
const VALID_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

/**
 * GET /api/settings - Returns user settings
 */
export const GET = withApiHandler(
  {
    endpoint: "/api/settings",
    method: "GET",
    errorMessage: "Failed to fetch settings",
  },
  async () => {
    const session = await requireUserSession();
    const userId = session.user.id;

    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
        },
        update: {},
      });
    }

    logger.log("Settings fetched", { userId, endpoint: "/api/settings" });

    return NextResponse.json(settings);
  }
);

/**
 * PUT /api/settings - Updates user settings
 */
export const PUT = withApiHandler(
  {
    endpoint: "/api/settings",
    method: "PUT",
    errorMessage: "Failed to update settings",
  },
  async (request: NextRequest) => {
    const session = await requireUserSession();
    const userId = session.user.id;
    const body = (await request.json()) as Record<string, unknown>;

    if (body.theme !== undefined) {
      if (!VALID_THEMES.includes(body.theme as string)) {
        throw new ApiError(
          "Invalid theme. Must be one of: light, dark, system",
          400
        );
      }
    }

    if (body.defaultTaskPoints !== undefined) {
      if (
        typeof body.defaultTaskPoints !== "number" ||
        body.defaultTaskPoints < 1
      ) {
        throw new ApiError("defaultTaskPoints must be a positive number", 400);
      }
    }

    if (body.defaultZoomLevel !== undefined) {
      if (
        typeof body.defaultZoomLevel !== "number" ||
        body.defaultZoomLevel < 0.5 ||
        body.defaultZoomLevel > 2.0
      ) {
        throw new ApiError("defaultZoomLevel must be between 0.5 and 2.0", 400);
      }
    }

    if (body.timeFormat !== undefined) {
      if (!VALID_TIME_FORMATS.includes(body.timeFormat as string)) {
        throw new ApiError("Invalid timeFormat. Must be one of: 12h, 24h", 400);
      }
    }

    if (body.dateFormat !== undefined) {
      if (!VALID_DATE_FORMATS.includes(body.dateFormat as string)) {
        throw new ApiError(
          "Invalid dateFormat. Must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD",
          400
        );
      }
    }

    if (body.schedulerIntervalSeconds !== undefined) {
      if (
        typeof body.schedulerIntervalSeconds !== "number" ||
        !Number.isInteger(body.schedulerIntervalSeconds) ||
        body.schedulerIntervalSeconds < 5 ||
        body.schedulerIntervalSeconds > 120
      ) {
        throw new ApiError(
          "schedulerIntervalSeconds must be an integer between 5 and 120",
          400
        );
      }
    }

    if (body.schedulerPauseOnInteractionSeconds !== undefined) {
      if (
        typeof body.schedulerPauseOnInteractionSeconds !== "number" ||
        !Number.isInteger(body.schedulerPauseOnInteractionSeconds) ||
        body.schedulerPauseOnInteractionSeconds < 10 ||
        body.schedulerPauseOnInteractionSeconds > 300
      ) {
        throw new ApiError(
          "schedulerPauseOnInteractionSeconds must be an integer between 10 and 300",
          400
        );
      }
    }

    if (body.calendarRefreshIntervalMinutes !== undefined) {
      if (
        typeof body.calendarRefreshIntervalMinutes !== "number" ||
        !Number.isInteger(body.calendarRefreshIntervalMinutes) ||
        body.calendarRefreshIntervalMinutes < 5 ||
        body.calendarRefreshIntervalMinutes > 120
      ) {
        throw new ApiError(
          "calendarRefreshIntervalMinutes must be an integer between 5 and 120",
          400
        );
      }
    }

    if (body.calendarFetchMonthsAhead !== undefined) {
      if (
        typeof body.calendarFetchMonthsAhead !== "number" ||
        !Number.isInteger(body.calendarFetchMonthsAhead) ||
        body.calendarFetchMonthsAhead < 1 ||
        body.calendarFetchMonthsAhead > 12
      ) {
        throw new ApiError(
          "calendarFetchMonthsAhead must be an integer between 1 and 12",
          400
        );
      }
    }

    if (body.calendarFetchMonthsBehind !== undefined) {
      if (
        typeof body.calendarFetchMonthsBehind !== "number" ||
        !Number.isInteger(body.calendarFetchMonthsBehind) ||
        body.calendarFetchMonthsBehind < 0 ||
        body.calendarFetchMonthsBehind > 6
      ) {
        throw new ApiError(
          "calendarFetchMonthsBehind must be an integer between 0 and 6",
          400
        );
      }
    }

    if (body.calendarMaxEventsPerDay !== undefined) {
      if (
        typeof body.calendarMaxEventsPerDay !== "number" ||
        !Number.isInteger(body.calendarMaxEventsPerDay) ||
        body.calendarMaxEventsPerDay < 1 ||
        body.calendarMaxEventsPerDay > 10
      ) {
        throw new ApiError(
          "calendarMaxEventsPerDay must be an integer between 1 and 10",
          400
        );
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...(body as Record<string, unknown>),
      },
      update: body,
    });

    logger.event("SettingsUpdated", { userId, endpoint: "/api/settings" });

    return NextResponse.json(settings);
  }
);
