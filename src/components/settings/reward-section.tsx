"use client";

import { usePointsOptional } from "@/components/rewards/points-context";
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
  const points = usePointsOptional();

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
            {points && points.profileId && (
              <div
                role="status"
                aria-label={`${points.totalPoints} total reward points`}
                className="flex items-center justify-between rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900"
              >
                <span>Total points</span>
                <span className="font-semibold tabular-nums">
                  {points.totalPoints.toLocaleString()}
                  <span className="ml-1 text-xs font-normal">
                    {"\u{1F3C6}"}
                  </span>
                </span>
              </div>
            )}

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
