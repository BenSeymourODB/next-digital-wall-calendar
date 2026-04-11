"use client";

import type {
  TransitionConfig,
  TransitionType,
} from "@/components/scheduler/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "./settings-section";

interface TransitionSectionProps {
  values: TransitionConfig;
  onChange: (values: TransitionConfig) => void;
}

const TRANSITION_TYPES: { value: TransitionType; label: string }[] = [
  { value: "slide", label: "Slide" },
  { value: "fade", label: "Fade" },
  { value: "slide-fade", label: "Slide + Fade" },
];

export function TransitionSection({
  values,
  onChange,
}: TransitionSectionProps) {
  const isEnabled = values.type !== "none";

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({ type: "slide", durationMs: values.durationMs || 400 });
    } else {
      onChange({ type: "none", durationMs: values.durationMs });
    }
  };

  const handleTypeChange = (type: TransitionType) => {
    onChange({ ...values, type });
  };

  const handleDurationChange = (durationMs: number) => {
    onChange({ ...values, durationMs });
  };

  return (
    <SettingsSection
      title="Page Transitions"
      description="Configure animated transitions between scheduler screens"
    >
      <div className="space-y-6">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="transition-toggle">Animated Transitions</Label>
            <p className="text-xs text-gray-400">
              Smooth animations when rotating between screens
            </p>
          </div>
          <Switch
            id="transition-toggle"
            checked={isEnabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Transition type dropdown */}
        {isEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="transition-type">Transition Type</Label>
              <Select
                value={values.type}
                onValueChange={(v) => handleTypeChange(v as TransitionType)}
              >
                <SelectTrigger id="transition-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transition-duration">Duration</Label>
                <span className="text-sm text-gray-500">
                  {values.durationMs}ms
                </span>
              </div>
              <Slider
                id="transition-duration"
                value={[values.durationMs]}
                min={200}
                max={1000}
                step={50}
                onValueChange={(v) => handleDurationChange(v[0])}
              />
              <p className="text-xs text-gray-400">
                Animation speed (200ms – 1000ms)
              </p>
            </div>
          </>
        )}

        {/* Reduced motion notice */}
        <p className="text-xs text-gray-500">
          Transitions are automatically disabled when your system has
          &quot;reduce motion&quot; enabled.
        </p>
      </div>
    </SettingsSection>
  );
}
