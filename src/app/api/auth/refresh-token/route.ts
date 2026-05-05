/**
 * API endpoint for refreshing Google OAuth access tokens
 * This server-side endpoint securely handles token refresh using the client secret
 */
import {
  GoogleTokenRefreshError,
  refreshGoogleAccessToken,
} from "@/lib/auth/refresh-google-token";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error(new Error("Missing OAuth credentials"), {
        context: "refreshToken",
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    try {
      const tokens = await refreshGoogleAccessToken(
        refreshToken,
        clientId,
        clientSecret
      );

      logger.log("Token refreshed successfully");

      return NextResponse.json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        token_type: tokens.token_type,
      });
    } catch (error) {
      if (error instanceof GoogleTokenRefreshError) {
        const body = error.body as { error?: string } | null;
        logger.error(new Error("Token refresh failed"), {
          context: "refreshToken",
          status: error.status,
          googleError: body?.error ?? "unknown",
        });

        if (
          body?.error === "invalid_grant" ||
          body?.error === "invalid_request"
        ) {
          return NextResponse.json(
            {
              error: "Invalid or expired refresh token",
              requiresReauth: true,
            },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: "Failed to refresh token" },
          { status: error.status }
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error(error as Error, { context: "refreshToken" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
