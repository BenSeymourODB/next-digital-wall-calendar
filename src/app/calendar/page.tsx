"use client";

import { AccountManager } from "@/components/calendar/AccountManager";
import { AgendaCalendar } from "@/components/calendar/AgendaCalendar";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import {
  CalendarProvider,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { Settings } from "lucide-react";

/**
 * Calendar content component
 * Extracted to access useCalendar hook
 */
function CalendarContent() {
  const { view } = useCalendar();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">Wall Calendar</h1>
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

        {/* View Switcher */}
        <ViewSwitcher />

        {/* Calendar - Conditional rendering based on view */}
        <div className="rounded-lg border border-stone-200 bg-white p-6">
          {view === "month" ? <SimpleCalendar /> : <AgendaCalendar />}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
      <Toaster />
    </CalendarProvider>
  );
}
