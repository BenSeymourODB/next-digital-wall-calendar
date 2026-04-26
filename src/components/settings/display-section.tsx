"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTheme } from "next-themes";
import { SettingsSection } from "./settings-section";

interface DisplayValues {
  theme: string;
  timeFormat: string;
  dateFormat: string;
  defaultZoomLevel: number;
}

interface DisplaySectionProps {
  values: DisplayValues;
  onChange: (values: Partial<DisplayValues>) => void;
}

const THEME_OPTIONS = ["light", "dark", "system"] as const;

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
                <span className="capitalize">{theme}</span>
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
