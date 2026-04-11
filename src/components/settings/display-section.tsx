"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

export function DisplaySection({ values, onChange }: DisplaySectionProps) {
  const zoomPercentage = Math.round(values.defaultZoomLevel * 100);

  return (
    <SettingsSection
      title="Display"
      description="Customize your display preferences"
    >
      <div className="space-y-6">
        {/* Theme selection */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Theme</legend>
          <div className="mt-2 flex gap-4">
            {(["light", "dark", "auto"] as const).map((theme) => (
              <Label key={theme} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  checked={values.theme === theme}
                  onChange={() => onChange({ theme })}
                  className="text-blue-600"
                />
                <span className="capitalize">{theme}</span>
              </Label>
            ))}
          </div>
        </fieldset>

        {/* Time format */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">
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
            <span className="text-sm text-gray-500">{zoomPercentage}%</span>
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
