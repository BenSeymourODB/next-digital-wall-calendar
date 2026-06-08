"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { TDateFormat } from "@/lib/format-date";
import type { TWeekStartDay } from "@/types/calendar";
import { useTheme } from "next-themes";
import { SettingsSection } from "./settings-section";

interface DisplayValues {
  theme: string;
  timeFormat: string;
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
          <div className="mt-2 flex gap-4">
            {THEME_OPTIONS.map((theme) => (
              <Label key={theme} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  checked={currentTheme === theme}
                  onChange={() => handleThemeChange(theme)}
                  className="text-blue-600"
                />
                <span>{THEME_LABELS[theme]}</span>
              </Label>
            ))}
          </div>
        </fieldset>

        {/* Time format */}
        <fieldset>
          <legend className="text-foreground text-sm font-medium">
            Time Format
          </legend>
          <div className="mt-2 flex gap-4">
            <Label className="flex items-center gap-2">
              <input
                type="radio"
                name="timeFormat"
                value="12h"
                checked={values.timeFormat === "12h"}
                onChange={() => onChange({ timeFormat: "12h" })}
                className="text-blue-600"
              />
              12-hour
            </Label>
            <Label className="flex items-center gap-2">
              <input
                type="radio"
                name="timeFormat"
                value="24h"
                checked={values.timeFormat === "24h"}
                onChange={() => onChange({ timeFormat: "24h" })}
                className="text-blue-600"
              />
              24-hour
            </Label>
          </div>
        </fieldset>

        {/* Week start day */}
        <fieldset>
          <legend className="text-foreground text-sm font-medium">
            Week starts on
          </legend>
          <div className="mt-2 flex gap-4">
            <Label className="flex items-center gap-2">
              <input
                type="radio"
                name="weekStartDay"
                value="0"
                checked={values.weekStartDay === 0}
                onChange={() => onChange({ weekStartDay: 0 })}
                className="accent-blue-600"
              />
              Sunday
            </Label>
            <Label className="flex items-center gap-2">
              <input
                type="radio"
                name="weekStartDay"
                value="1"
                checked={values.weekStartDay === 1}
                onChange={() => onChange({ weekStartDay: 1 })}
                className="accent-blue-600"
              />
              Monday
            </Label>
          </div>
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
