"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SettingsSection } from "./settings-section";

interface SchedulerValues {
  schedulerIntervalSeconds: number;
  schedulerPauseOnInteractionSeconds: number;
}

interface SchedulerSectionProps {
  values: SchedulerValues;
  onChange: (values: Partial<SchedulerValues>) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

export function SchedulerSection({ values, onChange }: SchedulerSectionProps) {
  return (
    <SettingsSection
      title="Screen Rotation"
      description="Configure how the scheduler rotates between screens"
    >
      <div className="space-y-6">
        {/* Rotation interval */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="scheduler-interval">Rotation Interval</Label>
            <span className="text-sm text-gray-500">
              {formatDuration(values.schedulerIntervalSeconds)}
            </span>
          </div>
          <Slider
            id="scheduler-interval"
            value={[values.schedulerIntervalSeconds]}
            min={5}
            max={120}
            step={5}
            onValueChange={(value) =>
              onChange({ schedulerIntervalSeconds: value[0] })
            }
          />
          <p className="text-xs text-gray-400">
            Time between automatic screen rotations (5s – 2m)
          </p>
        </div>

        {/* Pause on interaction */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="scheduler-pause">Pause on Interaction</Label>
            <span className="text-sm text-gray-500">
              {formatDuration(values.schedulerPauseOnInteractionSeconds)}
            </span>
          </div>
          <Slider
            id="scheduler-pause"
            value={[values.schedulerPauseOnInteractionSeconds]}
            min={10}
            max={300}
            step={10}
            onValueChange={(value) =>
              onChange({ schedulerPauseOnInteractionSeconds: value[0] })
            }
          />
          <p className="text-xs text-gray-400">
            How long to pause rotation after user interaction (10s – 5m)
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
