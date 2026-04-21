"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { TWeekStartDay } from "@/types/calendar";
import { Settings } from "lucide-react";

/**
 * Compact settings popover for calendar display preferences (#86).
 *
 * Reads and writes four settings already owned by `CalendarProvider`:
 *
 * - badgeVariant      — dot vs colored event badges
 * - use24HourFormat   — 24-hour vs 12-hour time display
 * - agendaModeGroupBy — date vs color grouping in agenda mode
 * - weekStartDay      — Sunday vs Monday week start
 *
 * The panel is meant to live next to the calendar toolbar; it's pure
 * UI around `useCalendar()` and has no other state of its own.
 */
export function CalendarSettingsPanel() {
  const {
    badgeVariant,
    setBadgeVariant,
    use24HourFormat,
    toggleTimeFormat,
    agendaModeGroupBy,
    setAgendaModeGroupBy,
    weekStartDay,
    setWeekStartDay,
  } = useCalendar();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="calendar-settings-trigger"
          aria-label="Calendar settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72"
        data-testid="calendar-settings-panel"
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Calendar display
            </h3>
            <p className="text-muted-foreground text-xs">
              Preferences apply across all calendar views.
            </p>
          </div>
          <Separator />

          {/* Event badge style */}
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <Label htmlFor="setting-badge-style" className="text-sm">
                Colored event badges
              </Label>
              <p className="text-muted-foreground text-xs">
                Off shows dots instead of full title pills.
              </p>
            </div>
            <Switch
              id="setting-badge-style"
              data-testid="setting-badge-style"
              checked={badgeVariant === "colored"}
              onCheckedChange={(checked) =>
                setBadgeVariant(checked ? "colored" : "dot")
              }
            />
          </div>

          {/* 24-hour format */}
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <Label htmlFor="setting-24hour" className="text-sm">
                24-hour time
              </Label>
              <p className="text-muted-foreground text-xs">
                Off uses 12-hour clock with AM/PM.
              </p>
            </div>
            <Switch
              id="setting-24hour"
              data-testid="setting-24hour"
              checked={use24HourFormat}
              onCheckedChange={toggleTimeFormat}
            />
          </div>

          <Separator />

          {/* Agenda group-by */}
          <fieldset className="space-y-2" data-testid="setting-agenda-group-by">
            <legend className="text-foreground text-sm font-medium">
              Agenda grouping
            </legend>
            <RadioGroup
              value={agendaModeGroupBy}
              onValueChange={(value) =>
                setAgendaModeGroupBy(value as "date" | "color")
              }
              className="gap-2"
            >
              <Label className="flex items-center gap-2 text-sm">
                <RadioGroupItem
                  value="date"
                  data-testid="setting-agenda-group-by-date"
                />
                By date
              </Label>
              <Label className="flex items-center gap-2 text-sm">
                <RadioGroupItem
                  value="color"
                  data-testid="setting-agenda-group-by-color"
                />
                By color
              </Label>
            </RadioGroup>
          </fieldset>

          {/* Week start day */}
          <fieldset className="space-y-2" data-testid="setting-week-start-day">
            <legend className="text-foreground text-sm font-medium">
              Week starts on
            </legend>
            <RadioGroup
              value={String(weekStartDay)}
              onValueChange={(value) =>
                setWeekStartDay(Number(value) as TWeekStartDay)
              }
              className="gap-2"
            >
              <Label className="flex items-center gap-2 text-sm">
                <RadioGroupItem
                  value="0"
                  data-testid="setting-week-start-day-sunday"
                />
                Sunday
              </Label>
              <Label className="flex items-center gap-2 text-sm">
                <RadioGroupItem
                  value="1"
                  data-testid="setting-week-start-day-monday"
                />
                Monday
              </Label>
            </RadioGroup>
          </fieldset>
        </div>
      </PopoverContent>
    </Popover>
  );
}
