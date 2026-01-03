/**
 * API endpoint for refreshing Google OAuth access tokens
 * This server-side endpoint securely handles token refresh using the client secret
 */
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

    // Exchange refresh token for new access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error(new Error("Token refresh failed"), {
        context: "refreshToken",
        status: response.status,
        error: errorData,
      });

      // Check for specific error types
      if (
        errorData.error === "invalid_grant" ||
        errorData.error === "invalid_request"
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
        { status: response.status }
      );
    }

    const data = await response.json();

    logger.log("Token refreshed successfully");

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      scope: data.scope,
      token_type: data.token_type,
    });
  } catch (error) {
    logger.error(error as Error, { context: "refreshToken" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
