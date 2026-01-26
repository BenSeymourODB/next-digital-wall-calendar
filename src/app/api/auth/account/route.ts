/**
 * API endpoint for fetching authenticated user's Google account info
 * Used by client components to display account information
 */
import { getGoogleAccount, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export interface AccountInfo {
  email: string;
  name: string | null;
  image: string | null;
  calendarIds: string[];
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if token refresh failed
    if (session.error === "RefreshTokenError") {
      return NextResponse.json(
        {
          error: "Session expired. Please sign in again.",
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    // Get Google account data
    const googleAccount = await getGoogleAccount();

    if (!googleAccount) {
      return NextResponse.json(
        { error: "No Google account linked" },
        { status: 404 }
      );
    }

    // For now, we return "primary" as the default calendar
    // In the future, we could fetch the user's calendar list
    const calendarIds = ["primary"];

    const accountInfo: AccountInfo = {
      email: session.user.email || "",
      name: session.user.name || null,
      image: session.user.image || null,
      calendarIds,
    };

    logger.log("Account info retrieved", {
      userId: session.user.id,
      email: session.user.email || "unknown",
    });

    return NextResponse.json(accountInfo);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/auth/account",
      errorType: "fetch_account",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
