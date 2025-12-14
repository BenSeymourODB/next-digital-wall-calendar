"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  addAccount,
  loadAccounts,
  removeAccount,
} from "@/lib/calendar-storage";
import {
  type GoogleCalendarAccount,
  fetchUserCalendars,
  signInToGoogle,
  signOutFromGoogle,
} from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";

export function AccountManager() {
  const { refreshEvents } = useCalendar();
  const [accounts, setAccounts] = useState<GoogleCalendarAccount[]>([]);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // Load accounts from storage
    const savedAccounts = loadAccounts();
    setAccounts(savedAccounts);
  }, []);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      const account = await signInToGoogle();

      // Fetch available calendars for this account (not used in UI yet, but good for future)
      await fetchUserCalendars();

      // Save account
      addAccount(account);
      setAccounts(loadAccounts());

      // Refresh events
      await refreshEvents();

      logger.event("AccountAdded", { accountId: account.id });
    } catch (error) {
      logger.error(error as Error, { context: "handleSignIn" });
      alert("Failed to sign in. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async (accountId: string) => {
    try {
      await signOutFromGoogle();
      removeAccount(accountId);
      setAccounts(loadAccounts());
      await refreshEvents();

      logger.event("AccountRemoved", { accountId });
    } catch (error) {
      logger.error(error as Error, { context: "handleSignOut" });
      alert("Failed to sign in. Please try again.");
    }
  };

  return (
    <Card className="border-stone-200">
      <CardHeader>
        <CardTitle className="text-stone-900">Calendar Accounts</CardTitle>
        <CardDescription className="text-stone-600">
          Connect your Google Calendar accounts to display events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-stone-600">
              No accounts connected yet. Add a Google Calendar account to get
              started.
            </p>
            <Button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="bg-sky-600 text-white hover:bg-sky-700"
            >
              {isSigningIn ? "Signing in..." : "Add Google Calendar Account"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3"
                >
                  <div>
                    <p className="font-medium text-stone-900">{account.name}</p>
                    <p className="text-sm text-stone-600">{account.email}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {account.calendarIds.length} calendar(s) selected
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSignOut(account.id)}
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSignIn}
              disabled={isSigningIn}
              variant="outline"
              className="w-full border-stone-200 hover:bg-stone-50"
            >
              {isSigningIn ? "Adding..." : "Add Another Account"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
