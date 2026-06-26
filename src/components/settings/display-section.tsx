"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import type { TDateFormat } from "@/lib/format-date";
import { type TTimeFormat, isTimeFormat } from "@/lib/time-format";
import type { TWeekStartDay } from "@/types/calendar";
import { useTheme } from "next-themes";
import { SettingsSection } from "./settings-section";

interface DisplayValues {
  theme: string;
  timeFormat: TTimeFormat;
  dateFormat: TDateFormat;
  defaultZoomLevel: number;
  weekStartDay: TWeekStartDay;
}

interface DisplaySectionProps {
  values: DisplayValues;
  onChange: (values: Partial<DisplayValues>) => void;
}

// Keep in sync with `THEMES` in `src/components/providers/ThemeProvider.tsx`
// and `VALID_THEMES` in `src/app/api/settings/route.ts`.
const THEME_OPTIONS = ["light", "dark", "wall-projector", "system"] as const;

const THEME_LABELS: Record<(typeof THEME_OPTIONS)[number], string> = {
  light: "Light",
  dark: "Dark",
  "wall-projector": "Wall-Projector",
  system: "System",
};

export function DisplaySection({ values, onChange }: DisplaySectionProps) {
  const { setTheme } = useTheme();
  const zoomPercentage = Math.round(values.defaultZoomLevel * 100);

  // Map legacy "auto" to "system" for display
  const currentTheme = values.theme === "auto" ? "system" : values.theme;

  const handleThemeChange = (theme: string) => {
    setTheme(theme);
    onChange({ theme });
  };

  return (
    <SettingsSection
      title="Display"
      description="Customize your display preferences"
    >
      <div className="space-y-6">
        {/* Theme selection */}
        <fieldset>
          <legend className="text-foreground text-sm font-medium">Theme</legend>
          <RadioGroup
            value={currentTheme}
            onValueChange={handleThemeChange}
            className="mt-2 flex gap-4"
          >
            {THEME_OPTIONS.map((theme) => (
              <Label key={theme} className="flex items-center gap-2">
                <RadioGroupItem
                  value={theme}
                  data-testid={`display-theme-${theme}`}
                />
                <span>{THEME_LABELS[theme]}</span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        {/* Time format */}
        <fieldset>
          <legend className="text-foreground text-sm font-medium">
            Time Format
          </legend>
          <RadioGroup
            value={values.timeFormat}
            onValueChange={(timeFormat) => {
              // Radix forwards the raw string of the selected radio item.
              // Both items below render values in the TTimeFormat union, so
              // this branch only filters out theoretical garbage from
              // future DOM tampering — TypeScript no longer accepts a
              // widened string at the callsite.
              if (isTimeFormat(timeFormat)) {
                onChange({ timeFormat });
              }
            }}
            className="mt-2 flex gap-4"
          >
            <Label className="flex items-center gap-2">
              <RadioGroupItem
                value="12h"
                data-testid="display-time-format-12h"
              />
              12-hour
            </Label>
            <Label className="flex items-center gap-2">
              <RadioGroupItem
                value="24h"
                data-testid="display-time-format-24h"
              />
              24-hour
            </Label>
          </RadioGroup>
        </fieldset>

        {/* Week start day */}
        <fieldset>
          <legend className="text-foreground text-sm font-medium">
            Week starts on
          </legend>
          <RadioGroup
            value={String(values.weekStartDay)}
            onValueChange={(value) =>
              onChange({ weekStartDay: Number(value) as TWeekStartDay })
            }
            className="mt-2 flex gap-4"
          >
            <Label className="flex items-center gap-2">
              <RadioGroupItem
                value="0"
                data-testid="display-week-start-day-sunday"
              />
              Sunday
            </Label>
            <Label className="flex items-center gap-2">
              <RadioGroupItem
                value="1"
                data-testid="display-week-start-day-monday"
              />
              Monday
            </Label>
          </RadioGroup>
        </fieldset>

        {/* Zoom level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Zoom Level</Label>
            <span className="text-muted-foreground text-sm">
              {zoomPercentage}%
            </span>
          </div>
          <Slider
            value={[values.defaultZoomLevel]}
            min={0.5}
            max={2.0}
            step={0.1}
            onValueChange={(value) => onChange({ defaultZoomLevel: value[0] })}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
