"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AccountSection } from "./account-section";
import { DisplaySection } from "./display-section";
import { PrivacySection } from "./privacy-section";
import { RewardSection } from "./reward-section";
import { TaskSection } from "./task-section";

interface UserSettingsData {
  theme: string;
  timeFormat: string;
  dateFormat: string;
  defaultZoomLevel: number;
  rewardSystemEnabled: boolean;
  defaultTaskPoints: number;
  showPointsOnCompletion: boolean;
}

interface SettingsFormProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  createdAt: string;
  providers: string[];
  initialSettings: UserSettingsData;
}

export function SettingsForm({
  user,
  createdAt,
  providers,
  initialSettings,
}: SettingsFormProps) {
  const [settings, setSettings] = useState<UserSettingsData>(initialSettings);
  const [taskSettings, setTaskSettings] = useState({
    taskSortOrder: "dueDate",
    showCompletedTasks: false,
  });

  const updateSettings = async (partial: Partial<UserSettingsData>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }
    } catch {
      toast.error("Failed to save settings");
      setSettings(settings);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch("/api/settings/delete-account", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      window.location.href = "/";
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const handleDeleteAllData = async () => {
    await handleDeleteAccount();
  };

  return (
    <div className="space-y-6">
      <AccountSection
        user={user}
        createdAt={createdAt}
        providers={providers}
        onDeleteAccount={handleDeleteAccount}
      />

      <DisplaySection
        values={{
          theme: settings.theme,
          timeFormat: settings.timeFormat,
          dateFormat: settings.dateFormat,
          defaultZoomLevel: settings.defaultZoomLevel,
        }}
        onChange={updateSettings}
      />

      <RewardSection
        values={{
          rewardSystemEnabled: settings.rewardSystemEnabled,
          defaultTaskPoints: settings.defaultTaskPoints,
          showPointsOnCompletion: settings.showPointsOnCompletion,
        }}
        onChange={updateSettings}
      />

      <TaskSection
        values={taskSettings}
        onChange={(partial) =>
          setTaskSettings((prev) => ({ ...prev, ...partial }))
        }
      />

      <PrivacySection
        permissions={["Google Calendar (read)", "Google Tasks (read/write)"]}
        onDeleteAllData={handleDeleteAllData}
      />
    </div>
  );
}
