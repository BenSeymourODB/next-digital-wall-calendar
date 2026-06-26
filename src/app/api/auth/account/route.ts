/**
 * API endpoint for fetching authenticated user's Google account info
 * Used by client components to display account information
 */
import {
  AuthError,
  getGoogleAccount,
  requireAuthenticatedSession,
} from "@/lib/auth";
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
    // Handles session existence + RefreshTokenError in one place (#441).
    const { session } = await requireAuthenticatedSession();

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
    if (error instanceof AuthError) {
      const requiresReauth =
        error.requiresReauth ?? (error.status === 401 || error.status === 403);
      const body: Record<string, unknown> = { error: error.message };
      if (requiresReauth) body.requiresReauth = true;
      return NextResponse.json(body, { status: error.status });
    }

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
