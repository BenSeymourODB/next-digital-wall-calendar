"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "./settings-section";

interface RewardValues {
  rewardSystemEnabled: boolean;
  defaultTaskPoints: number;
  showPointsOnCompletion: boolean;
}

interface RewardSectionProps {
  values: RewardValues;
  onChange: (values: Partial<RewardValues>) => void;
}

export function RewardSection({ values, onChange }: RewardSectionProps) {
  return (
    <SettingsSection
      title="Rewards"
      description="Configure the reward point system"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="reward-toggle">Enable reward system</Label>
          <Switch
            id="reward-toggle"
            checked={values.rewardSystemEnabled}
            onCheckedChange={(checked) =>
              onChange({ rewardSystemEnabled: checked })
            }
          />
        </div>

        {values.rewardSystemEnabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-points">Default points per task</Label>
              <Input
                id="default-points"
                type="number"
                min={1}
                value={values.defaultTaskPoints}
                onChange={(e) =>
                  onChange({
                    defaultTaskPoints: parseInt(e.target.value, 10) || 1,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-points-toggle">
                Show points on completion
              </Label>
              <Switch
                id="show-points-toggle"
                checked={values.showPointsOnCompletion}
                onCheckedChange={(checked) =>
                  onChange({ showPointsOnCompletion: checked })
                }
              />
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
