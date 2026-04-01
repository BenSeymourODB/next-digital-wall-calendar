import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const VALID_THEMES = ["light", "dark", "auto"];
const VALID_TIME_FORMATS = ["12h", "24h"];
const VALID_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

/**
 * GET /api/settings - Returns user settings
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/settings",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings - Updates user settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = (await request.json()) as Record<string, unknown>;

    // Validate theme
    if (body.theme !== undefined) {
      if (!VALID_THEMES.includes(body.theme as string)) {
        return NextResponse.json(
          { error: "Invalid theme. Must be one of: light, dark, auto" },
          { status: 400 }
        );
      }
    }

    // Validate defaultTaskPoints
    if (body.defaultTaskPoints !== undefined) {
      if (
        typeof body.defaultTaskPoints !== "number" ||
        body.defaultTaskPoints < 1
      ) {
        return NextResponse.json(
          { error: "defaultTaskPoints must be a positive number" },
          { status: 400 }
        );
      }
    }

    // Validate defaultZoomLevel
    if (body.defaultZoomLevel !== undefined) {
      if (
        typeof body.defaultZoomLevel !== "number" ||
        body.defaultZoomLevel < 0.5 ||
        body.defaultZoomLevel > 2.0
      ) {
        return NextResponse.json(
          {
            error: "defaultZoomLevel must be between 0.5 and 2.0",
          },
          { status: 400 }
        );
      }
    }

    // Validate timeFormat
    if (body.timeFormat !== undefined) {
      if (!VALID_TIME_FORMATS.includes(body.timeFormat as string)) {
        return NextResponse.json(
          { error: "Invalid timeFormat. Must be one of: 12h, 24h" },
          { status: 400 }
        );
      }
    }

    // Validate dateFormat
    if (body.dateFormat !== undefined) {
      if (!VALID_DATE_FORMATS.includes(body.dateFormat as string)) {
        return NextResponse.json(
          {
            error:
              "Invalid dateFormat. Must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD",
          },
          { status: 400 }
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
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/settings",
      method: "PUT",
    });
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
