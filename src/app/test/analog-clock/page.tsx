"use client";

import {
  AnalogClock,
  calculateArcAngles,
  getPeriodStart,
  parseEventTitle,
} from "@/components/calendar/analog-clock";
import type { ClockEvent } from "@/components/calendar/analog-clock";
import { TAILWIND_COLORS } from "@/lib/color-utils";
import type { TEventColor } from "@/types/calendar";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Create mock ClockEvents from a scenario definition.
 * Uses a fixed reference time so events position consistently.
 */
function createMockClockEvents(
  scenario: string,
  referenceTime: Date
): ClockEvent[] {
  const periodStart = getPeriodStart(referenceTime);
  const isPM = referenceTime.getHours() >= 12;
  const baseHour = isPM ? 12 : 0;

  const scenarios: Record<
    string,
    Array<{
      id: string;
      title: string;
      startHour: number;
      startMin: number;
      endHour: number;
      endMin: number;
      color: TEventColor;
    }>
  > = {
    default: [
      {
        id: "d1",
        title: "🟢 🎮 Family Game Night",
        startHour: 3,
        startMin: 0,
        endHour: 4,
        endMin: 30,
        color: "green",
      },
      {
        id: "d2",
        title: "🔴 Deadline",
        startHour: 5,
        startMin: 0,
        endHour: 5,
        endMin: 30,
        color: "red",
      },
      {
        id: "d3",
        title: "Team Standup",
        startHour: 9,
        startMin: 0,
        endHour: 9,
        endMin: 30,
        color: "blue",
      },
      {
        id: "d4",
        title: "🟣 Lunch with Team",
        startHour: 6,
        startMin: 0,
        endHour: 7,
        endMin: 0,
        color: "purple",
      },
      {
        id: "d5",
        title: "🟠 🏋️ Gym Session",
        startHour: 7,
        startMin: 30,
        endHour: 8,
        endMin: 30,
        color: "orange",
      },
    ],
    overlap: [
      {
        id: "o1",
        title: "🔵 Meeting A",
        startHour: 2,
        startMin: 0,
        endHour: 4,
        endMin: 0,
        color: "blue",
      },
      {
        id: "o2",
        title: "🟢 Meeting B",
        startHour: 3,
        startMin: 0,
        endHour: 5,
        endMin: 0,
        color: "green",
      },
      {
        id: "o3",
        title: "🔴 Meeting C",
        startHour: 4,
        startMin: 0,
        endHour: 6,
        endMin: 0,
        color: "red",
      },
    ],
    colors: [
      {
        id: "c1",
        title: "🔴 Red Event",
        startHour: 0,
        startMin: 0,
        endHour: 1,
        endMin: 0,
        color: "red",
      },
      {
        id: "c2",
        title: "🟠 Orange Event",
        startHour: 1,
        startMin: 0,
        endHour: 2,
        endMin: 0,
        color: "orange",
      },
      {
        id: "c3",
        title: "🟡 Yellow Event",
        startHour: 2,
        startMin: 0,
        endHour: 3,
        endMin: 0,
        color: "yellow",
      },
      {
        id: "c4",
        title: "🟢 Green Event",
        startHour: 4,
        startMin: 0,
        endHour: 5,
        endMin: 0,
        color: "green",
      },
      {
        id: "c5",
        title: "🔵 Blue Event",
        startHour: 6,
        startMin: 0,
        endHour: 7,
        endMin: 0,
        color: "blue",
      },
      {
        id: "c6",
        title: "🟣 Purple Event",
        startHour: 8,
        startMin: 0,
        endHour: 9,
        endMin: 0,
        color: "purple",
      },
    ],
    family: [
      {
        id: "f1",
        title: "🔵 📧 Work Email Review",
        startHour: 8,
        startMin: 0,
        endHour: 8,
        endMin: 30,
        color: "blue",
      },
      {
        id: "f2",
        title: "🟢 ⚽ Soccer Practice",
        startHour: 3,
        startMin: 30,
        endHour: 5,
        endMin: 0,
        color: "green",
      },
      {
        id: "f3",
        title: "🟣 🎹 Piano Lesson",
        startHour: 5,
        startMin: 0,
        endHour: 6,
        endMin: 0,
        color: "purple",
      },
      {
        id: "f4",
        title: "🟡 🍽️ Family Dinner",
        startHour: 6,
        startMin: 0,
        endHour: 7,
        endMin: 30,
        color: "yellow",
      },
      {
        id: "f5",
        title: "🔴 📋 Deadline",
        startHour: 10,
        startMin: 0,
        endHour: 11,
        endMin: 0,
        color: "red",
      },
    ],
    empty: [],
    single: [
      {
        id: "s1",
        title: "🔵 Only Event",
        startHour: 3,
        startMin: 0,
        endHour: 4,
        endMin: 0,
        color: "blue",
      },
    ],
    dense: [
      {
        id: "dn1",
        title: "🔴 A",
        startHour: 0,
        startMin: 0,
        endHour: 1,
        endMin: 0,
        color: "red",
      },
      {
        id: "dn2",
        title: "🟠 B",
        startHour: 1,
        startMin: 0,
        endHour: 2,
        endMin: 0,
        color: "orange",
      },
      {
        id: "dn3",
        title: "🟡 C",
        startHour: 2,
        startMin: 0,
        endHour: 3,
        endMin: 0,
        color: "yellow",
      },
      {
        id: "dn4",
        title: "🟢 D",
        startHour: 3,
        startMin: 0,
        endHour: 4,
        endMin: 0,
        color: "green",
      },
      {
        id: "dn5",
        title: "🔵 E",
        startHour: 4,
        startMin: 0,
        endHour: 5,
        endMin: 0,
        color: "blue",
      },
      {
        id: "dn6",
        title: "🟣 F",
        startHour: 5,
        startMin: 0,
        endHour: 6,
        endMin: 0,
        color: "purple",
      },
      {
        id: "dn7",
        title: "🔴 G",
        startHour: 6,
        startMin: 0,
        endHour: 7,
        endMin: 0,
        color: "red",
      },
      {
        id: "dn8",
        title: "🟢 H",
        startHour: 7,
        startMin: 0,
        endHour: 8,
        endMin: 0,
        color: "green",
      },
      {
        id: "dn9",
        title: "🔵 I",
        startHour: 8,
        startMin: 0,
        endHour: 9,
        endMin: 0,
        color: "blue",
      },
      {
        id: "dn10",
        title: "🟠 J",
        startHour: 9,
        startMin: 0,
        endHour: 10,
        endMin: 0,
        color: "orange",
      },
      {
        id: "dn11",
        title: "🟡 K",
        startHour: 10,
        startMin: 0,
        endHour: 11,
        endMin: 0,
        color: "yellow",
      },
      {
        id: "dn12",
        title: "🟣 L",
        startHour: 11,
        startMin: 0,
        endHour: 11,
        endMin: 59,
        color: "purple",
      },
    ],
  };

  const eventDefs = scenarios[scenario] || scenarios.default;

  return eventDefs.map((def) => {
    const start = new Date(referenceTime);
    start.setHours(baseHour + def.startHour, def.startMin, 0, 0);
    const end = new Date(referenceTime);
    end.setHours(baseHour + def.endHour, def.endMin, 0, 0);

    const fallbackColor = TAILWIND_COLORS[def.color] || "#3B82F6";
    const parsed = parseEventTitle(def.title, fallbackColor);
    const angles = calculateArcAngles(start, end, periodStart);

    return {
      id: def.id,
      title: def.title,
      cleanTitle: parsed.cleanTitle,
      startAngle: angles.startAngle,
      endAngle: angles.endAngle,
      color: parsed.color,
      eventEmoji: parsed.eventEmoji,
      isAllDay: false,
    };
  });
}

function TestClockContent() {
  const searchParams = useSearchParams();

  const scenario = searchParams.get("scenario") || "default";
  const size = parseInt(searchParams.get("size") || "600", 10);
  const showSeconds = searchParams.get("seconds") === "true";
  const fixedHour = searchParams.get("hour");
  const fixedMin = searchParams.get("min");

  // Use a fixed reference time for consistent test screenshots
  const referenceTime = new Date();
  if (fixedHour !== null) {
    referenceTime.setHours(parseInt(fixedHour, 10));
  }
  if (fixedMin !== null) {
    referenceTime.setMinutes(parseInt(fixedMin, 10));
  }
  referenceTime.setSeconds(0, 0);

  const events = createMockClockEvents(scenario, referenceTime);

  return (
    <div className="min-h-screen bg-gray-950 p-8" data-testid="test-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-white">
          Analog Clock Test Page
        </h1>

        <div
          className="rounded bg-gray-800 p-2 text-sm text-gray-400"
          data-testid="test-config"
        >
          <strong>Config:</strong> scenario={scenario}, size={size}, seconds=
          {String(showSeconds)}, hour=
          {fixedHour ?? "now"}, events=
          {events.length}
        </div>

        {/* Main clock display */}
        <div
          className="flex items-center justify-center rounded-xl bg-gray-900 p-8"
          data-testid="clock-container"
        >
          <AnalogClock
            size={size}
            events={events}
            showSeconds={showSeconds}
            currentTime={referenceTime}
            arcThickness={size * 0.08}
          />
        </div>

        {/* Event legend */}
        {events.length > 0 && (
          <div
            className="rounded-lg border border-gray-700 bg-gray-900 p-4"
            data-testid="event-legend"
          >
            <h2 className="mb-3 text-sm font-semibold text-gray-300">
              Events ({events.length})
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center gap-2 text-sm text-gray-300"
                  data-testid={`legend-item-${evt.id}`}
                >
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: evt.color }}
                  />
                  <span>
                    {evt.eventEmoji && `${evt.eventEmoji} `}
                    {evt.cleanTitle}
                  </span>
                  <span className="text-gray-500">
                    ({Math.round(evt.startAngle)}° - {Math.round(evt.endAngle)}
                    °)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Test page for E2E testing of the AnalogClock component.
 *
 * URL Parameters:
 * - scenario: Event scenario (default, overlap, colors, family, empty, single, dense)
 * - size: Clock size in pixels (default: 600)
 * - seconds: Show second hand (true/false)
 * - hour: Fixed hour (0-23) for consistent screenshots
 * - min: Fixed minute (0-59) for consistent screenshots
 *
 * Examples:
 * - /test/analog-clock - Default events
 * - /test/analog-clock?scenario=colors&hour=14 - Color test at 2 PM
 * - /test/analog-clock?scenario=overlap - Overlapping events
 * - /test/analog-clock?scenario=family&hour=15 - Family calendar at 3 PM
 * - /test/analog-clock?scenario=empty - No events
 * - /test/analog-clock?scenario=dense&size=800 - Dense schedule, large clock
 */
export default function TestAnalogClockPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
          Loading clock test...
        </div>
      }
    >
      <TestClockContent />
    </Suspense>
  );
}
