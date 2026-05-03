"use client";

import { RadialClock } from "@/components/calendar/radial-clock";
import type { IEvent, TEventColor } from "@/types/calendar";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Create a date at a specific hour/minute on April 2 2026.
 * Using a fixed date ensures consistent test behavior.
 */
function fixedDate(hours: number, minutes = 0): string {
  return new Date(2026, 3, 2, hours, minutes, 0).toISOString();
}

function createEvent(overrides: Partial<IEvent> & { id: string }): IEvent {
  return {
    title: "Test Event",
    startDate: fixedDate(9, 0),
    endDate: fixedDate(10, 0),
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: { id: "user-1", name: "Test User", picturePath: null },
    ...overrides,
  };
}

/**
 * Mock event sets for different test scenarios.
 */
const mockEventSets: Record<string, IEvent[]> = {
  // Rich set of events spread across AM period
  default: [
    createEvent({
      id: "morning-standup",
      title: "🔵 💬 Morning Standup",
      startDate: fixedDate(9, 0),
      endDate: fixedDate(9, 30),
      color: "blue",
    }),
    createEvent({
      id: "gym-session",
      title: "🟢 🏋️ Gym Session",
      startDate: fixedDate(6, 0),
      endDate: fixedDate(7, 30),
      color: "green",
    }),
    createEvent({
      id: "team-lunch",
      title: "🟡 🍕 Team Lunch",
      startDate: fixedDate(11, 0),
      endDate: fixedDate(11, 45),
      color: "yellow",
    }),
    createEvent({
      id: "code-review",
      title: "🟣 Code Review",
      startDate: fixedDate(10, 0),
      endDate: fixedDate(11, 0),
      color: "purple",
    }),
    createEvent({
      id: "breakfast",
      title: "🟠 🥐 Breakfast",
      startDate: fixedDate(7, 30),
      endDate: fixedDate(8, 0),
      color: "orange",
    }),
  ],

  // PM period events
  pm: [
    createEvent({
      id: "pm-meeting",
      title: "🔴 📋 Project Review",
      startDate: fixedDate(14, 0),
      endDate: fixedDate(15, 30),
      color: "red",
    }),
    createEvent({
      id: "pm-workshop",
      title: "🔵 🎓 Workshop",
      startDate: fixedDate(16, 0),
      endDate: fixedDate(18, 0),
      color: "blue",
    }),
    createEvent({
      id: "pm-dinner",
      title: "🟢 🍽️ Family Dinner",
      startDate: fixedDate(19, 0),
      endDate: fixedDate(20, 30),
      color: "green",
    }),
    createEvent({
      id: "pm-movie",
      title: "🟣 🎬 Movie Night",
      startDate: fixedDate(21, 0),
      endDate: fixedDate(23, 0),
      color: "purple",
    }),
  ],

  // Empty state
  empty: [],

  // Single event
  single: [
    createEvent({
      id: "single-1",
      title: "🔵 📊 Presentation",
      startDate: fixedDate(9, 0),
      endDate: fixedDate(10, 30),
    }),
  ],

  // Many overlapping events
  overlap: [
    createEvent({
      id: "overlap-1",
      title: "🔴 Meeting A",
      startDate: fixedDate(9, 0),
      endDate: fixedDate(10, 0),
    }),
    createEvent({
      id: "overlap-2",
      title: "🔵 Meeting B",
      startDate: fixedDate(9, 15),
      endDate: fixedDate(10, 15),
    }),
    createEvent({
      id: "overlap-3",
      title: "🟢 Meeting C",
      startDate: fixedDate(9, 30),
      endDate: fixedDate(10, 30),
    }),
  ],

  // All color variations
  colors: (
    [
      { emoji: "🔴", color: "red" },
      { emoji: "🟠", color: "orange" },
      { emoji: "🟡", color: "yellow" },
      { emoji: "🟢", color: "green" },
      { emoji: "🔵", color: "blue" },
      { emoji: "🟣", color: "purple" },
    ] as { emoji: string; color: TEventColor }[]
  ).map(({ emoji, color }, i) =>
    createEvent({
      id: `color-${color}`,
      title: `${emoji} ${color.charAt(0).toUpperCase() + color.slice(1)} Event`,
      startDate: fixedDate(1 + i * 2, 0),
      endDate: fixedDate(2 + i * 2, 30),
      color,
    })
  ),

  // Events with emoji
  emoji: [
    createEvent({
      id: "emoji-game",
      title: "🟢 🎮 Game Night",
      startDate: fixedDate(2, 0),
      endDate: fixedDate(4, 0),
    }),
    createEvent({
      id: "emoji-gym",
      title: "🏋️ Gym Session",
      startDate: fixedDate(6, 0),
      endDate: fixedDate(7, 30),
    }),
    createEvent({
      id: "emoji-food",
      title: "🔴 🍕 Pizza Party",
      startDate: fixedDate(8, 0),
      endDate: fixedDate(9, 0),
    }),
    createEvent({
      id: "emoji-music",
      title: "🟣 🎵 Music Lesson",
      startDate: fixedDate(10, 0),
      endDate: fixedDate(11, 0),
    }),
  ],

  // Includes all-day event that should be filtered out
  allday: [
    createEvent({
      id: "allday-holiday",
      title: "Holiday",
      startDate: fixedDate(0, 0),
      endDate: new Date(2026, 3, 3, 0, 0).toISOString(),
      isAllDay: true,
    }),
    createEvent({
      id: "allday-regular",
      title: "🔵 Regular Event",
      startDate: fixedDate(9, 0),
      endDate: fixedDate(10, 0),
    }),
  ],
};

function RadialClockTestContent() {
  const searchParams = useSearchParams();

  const eventSet = searchParams.get("events") || "default";
  const period = searchParams.get("period") || "am"; // am or pm
  const sizeParam = searchParams.get("size");
  const size = sizeParam ? parseInt(sizeParam, 10) : 500;

  const events = mockEventSets[eventSet] || mockEventSets.default;

  // Fixed time for deterministic testing
  const currentTime =
    period === "pm"
      ? new Date(2026, 3, 2, 15, 30, 0) // 3:30 PM
      : new Date(2026, 3, 2, 9, 30, 0); // 9:30 AM

  return (
    <div className="container mx-auto max-w-4xl p-4" data-testid="test-page">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">
        Radial Clock Test Page
      </h1>

      <div
        className="mb-4 rounded bg-gray-100 p-2 text-sm text-gray-600"
        data-testid="test-config"
      >
        <strong>Test Config:</strong> events={eventSet}, period={period}, size=
        {size}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <span className="font-medium text-gray-700">Event sets:</span>
        {Object.keys(mockEventSets).map((key) => (
          <a
            key={key}
            href={`/test/radial-clock?events=${key}&period=${period}&size=${size}`}
            className={`rounded px-2 py-1 ${
              key === eventSet
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {key}
          </a>
        ))}
      </div>

      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8">
        <RadialClock events={events} currentTime={currentTime} size={size} />
      </div>

      <div className="mt-6" data-testid="event-list">
        <h2 className="mb-2 text-lg font-semibold text-gray-800">
          Events in set &quot;{eventSet}&quot;
        </h2>
        {events.length === 0 ? (
          <p className="text-gray-500">No events</p>
        ) : (
          <ul className="space-y-1">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-2 text-sm text-gray-700"
                data-testid={`event-list-item-${event.id}`}
              >
                <span className="font-mono text-xs text-gray-400">
                  {new Date(event.startDate).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(event.endDate).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{event.title}</span>
                {event.isAllDay && (
                  <span className="rounded bg-yellow-100 px-1 text-xs text-yellow-700">
                    all-day
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Test page for E2E testing of the RadialClock component.
 *
 * URL Parameters:
 * - events: Event set (default, pm, empty, single, overlap, colors, emoji, allday)
 * - period: am or pm (controls the fixed time)
 * - size: Clock size in pixels (default: 500)
 *
 * Examples:
 * - /test/radial-clock - Default AM events
 * - /test/radial-clock?events=pm&period=pm - PM events
 * - /test/radial-clock?events=colors - All color variations
 * - /test/radial-clock?events=emoji - Events with emoji
 * - /test/radial-clock?events=empty - Empty state
 */
export default function TestRadialClockPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-4">Loading test page...</div>
      }
    >
      <RadialClockTestContent />
    </Suspense>
  );
}
