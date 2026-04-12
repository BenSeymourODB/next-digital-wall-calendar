"use client";

import type { AccountInfo } from "@/app/api/auth/account/route";
import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { toast } from "sonner";

export function AccountManager() {
  const { refreshEvents, isAuthenticated } = useCalendar();
  const { data: session, status } = useSession();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Fetch account info when authenticated
  useEffect(() => {
    const fetchAccountInfo = async () => {
      if (status !== "authenticated") {
        setAccountInfo(null);
        return;
      }

      try {
        const response = await fetch("/api/auth/account");
        if (response.ok) {
          const data = await response.json();
          setAccountInfo(data);
        }
      } catch (error) {
        logger.error(error as Error, { context: "fetchAccountInfo" });
      }
    };

    fetchAccountInfo();
  }, [status]);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      // Sign in with Google via NextAuth
      await signIn("google", { callbackUrl: "/calendar" });
      // Note: signIn redirects, so this code may not execute
    } catch (error) {
      logger.error(error as Error, { context: "handleSignIn" });
      toast.error("Failed to sign in. Please try again.");
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      // Sign out via NextAuth
      await signOut({ callbackUrl: "/calendar" });
      // Note: signOut redirects, so this code may not execute
      setAccountInfo(null);
      await refreshEvents();
      toast.success("Signed out successfully");
    } catch (error) {
      logger.error(error as Error, { context: "handleSignOut" });
      toast.error("Failed to sign out. Please try again.");
      setIsSigningOut(false);
    }
  };

  // Show session error if refresh token failed
  if (session?.error === "RefreshTokenError") {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950">
        <CardHeader>
          <CardTitle className="text-yellow-800 dark:text-yellow-200">
            Session Expired
          </CardTitle>
          <CardDescription className="text-yellow-700 dark:text-yellow-300">
            Your Google session has expired. Please sign in again to continue
            viewing your calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isSigningIn ? "Signing in..." : "Sign in with Google"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Accounts</CardTitle>
        <CardDescription>
          Connect your Google Calendar account to display events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "loading" ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Sign in with your Google account to view your calendar events.
            </p>
            <Button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSigningIn ? "Signing in..." : "Sign in with Google"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="border-border bg-muted flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  {session?.user?.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-foreground font-medium">
                      {session?.user?.name || "Google Account"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {session?.user?.email}
                    </p>
                    {accountInfo && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {accountInfo.calendarIds.length} calendar(s) connected
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <p className="text-sm text-green-700 dark:text-green-300">
                Your Google Calendar is connected. Events will automatically
                sync every 15 minutes.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
