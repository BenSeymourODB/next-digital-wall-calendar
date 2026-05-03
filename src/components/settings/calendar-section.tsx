"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SettingsSection } from "./settings-section";

interface CalendarValues {
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
}

interface CalendarSectionProps {
  values: CalendarValues;
  onChange: (values: Partial<CalendarValues>) => void;
}

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function CalendarSection({ values, onChange }: CalendarSectionProps) {
  return (
    <SettingsSection
      title="Calendar"
      description="How often the calendar fetches events and how much data is loaded at once."
    >
      <div className="space-y-6">
        {/* Refresh interval */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="calendar-refresh-interval">Refresh Interval</Label>
            <span className="text-sm text-gray-500">
              {pluralize(values.calendarRefreshIntervalMinutes, "minute")}
            </span>
          </div>
          <Slider
            id="calendar-refresh-interval"
            value={[values.calendarRefreshIntervalMinutes]}
            min={5}
            max={120}
            step={5}
            onValueChange={(value) =>
              onChange({ calendarRefreshIntervalMinutes: value[0] })
            }
          />
          <p className="text-xs text-gray-400">
            How often to automatically sync with Google Calendar (5m – 2h)
          </p>
        </div>

        {/* Fetch months ahead */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="calendar-fetch-ahead">Months Ahead</Label>
            <span className="text-sm text-gray-500">
              {pluralize(values.calendarFetchMonthsAhead, "month")}
            </span>
          </div>
          <Slider
            id="calendar-fetch-ahead"
            value={[values.calendarFetchMonthsAhead]}
            min={1}
            max={12}
            step={1}
            onValueChange={(value) =>
              onChange({ calendarFetchMonthsAhead: value[0] })
            }
          />
          <p className="text-xs text-gray-400">
            How far into the future to fetch events (1 – 12 months)
          </p>
        </div>

        {/* Fetch months behind */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="calendar-fetch-behind">Months Behind</Label>
            <span className="text-sm text-gray-500">
              {pluralize(values.calendarFetchMonthsBehind, "month")}
            </span>
          </div>
          <Slider
            id="calendar-fetch-behind"
            value={[values.calendarFetchMonthsBehind]}
            min={0}
            max={6}
            step={1}
            onValueChange={(value) =>
              onChange({ calendarFetchMonthsBehind: value[0] })
            }
          />
          <p className="text-xs text-gray-400">
            How far into the past to fetch events (0 – 6 months)
          </p>
        </div>

        {/* Max events per day */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="calendar-max-events">Max Events Per Day</Label>
            <span className="text-sm text-gray-500">
              {pluralize(values.calendarMaxEventsPerDay, "event")}
            </span>
          </div>
          <Slider
            id="calendar-max-events"
            value={[values.calendarMaxEventsPerDay]}
            min={1}
            max={10}
            step={1}
            onValueChange={(value) =>
              onChange({ calendarMaxEventsPerDay: value[0] })
            }
          />
          <p className="text-xs text-gray-400">
            How many events to show per day cell before collapsing to &ldquo;+N
            more&rdquo;
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
