"use client";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CALENDAR_TRANSITION_SPEEDS,
  type CalendarTransitionSpeed,
  isCalendarTransitionSpeed,
} from "@/lib/calendar/transition-speed";
import { SettingsSection } from "./settings-section";

interface CalendarTransitionValues {
  calendarTransitionSpeed: CalendarTransitionSpeed;
}

interface CalendarTransitionSectionProps {
  values: CalendarTransitionValues;
  onChange: (values: Partial<CalendarTransitionValues>) => void;
}

const SPEED_LABELS: Record<CalendarTransitionSpeed, string> = {
  off: "Off",
  fast: "Fast",
  normal: "Normal",
  slow: "Slow",
};

export function CalendarTransitionSection({
  values,
  onChange,
}: CalendarTransitionSectionProps) {
  const handleValueChange = (next: string) => {
    // Radix ToggleGroup (type=single) emits "" when the user re-clicks the
    // pressed item. Drop that — the speed is required, so there is no
    // "unselected" state to fall into.
    if (!isCalendarTransitionSpeed(next)) {
      return;
    }
    if (next === values.calendarTransitionSpeed) {
      return;
    }
    onChange({ calendarTransitionSpeed: next });
  };

  return (
    <SettingsSection
      title="Calendar Transitions"
      description="Speed of the slide / fade animations when navigating between months and views."
    >
      <div className="space-y-2">
        <Label htmlFor="calendar-transition-speed">Speed</Label>
        <ToggleGroup
          id="calendar-transition-speed"
          data-testid="calendar-transition-speed"
          type="single"
          variant="outline"
          value={values.calendarTransitionSpeed}
          onValueChange={handleValueChange}
        >
          {CALENDAR_TRANSITION_SPEEDS.map((speed) => (
            <ToggleGroupItem
              key={speed}
              value={speed}
              aria-label={SPEED_LABELS[speed]}
            >
              {SPEED_LABELS[speed]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-gray-400">
          &ldquo;Off&rdquo; turns animations off entirely. Animations are also
          disabled when your system has &ldquo;reduce motion&rdquo; enabled.
        </p>
      </div>
    </SettingsSection>
  );
}
