"use client";

import { AccountManager } from "@/components/calendar/AccountManager";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { CalendarProvider } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { Settings } from "lucide-react";

export default function CalendarPage() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <CalendarProvider>
      <div className="min-h-screen bg-stone-50 p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">
                Wall Calendar
              </h1>
              <p className="text-stone-600">
                Your family&apos;s digital calendar
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="border-stone-200 hover:bg-stone-100"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <AccountManager />
            </div>
          )}

          {/* Calendar */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <SimpleCalendar />
          </div>
        </div>
      </div>
      <Toaster />
    </CalendarProvider>
  );
}
