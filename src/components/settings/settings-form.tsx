"use client";

import { useProfile } from "@/components/profiles/profile-context";
import type { TransitionConfig } from "@/components/scheduler/types";
import type { CalendarTransitionSpeed } from "@/lib/calendar/transition-speed";
import { DEFAULT_TRANSITION_CONFIG } from "@/lib/scheduler/schedule-config";
import {
  loadScheduleConfig,
  saveScheduleConfig,
} from "@/lib/scheduler/schedule-storage";
import { emitUserSettingsChange } from "@/lib/user-settings-bus";
import type { TWeekStartDay } from "@/types/calendar";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountSection } from "./account-section";
import { CalendarSection } from "./calendar-section";
import { CalendarTransitionSection } from "./calendar-transition-section";
import { DisplaySection } from "./display-section";
import { PrivacySection } from "./privacy-section";
import { RewardSection } from "./reward-section";
import { SchedulerSection } from "./scheduler-section";
import { TaskSection } from "./task-section";
import { TransitionSection } from "./transition-section";

interface ProfileTaskSettings {
  taskSortOrder: string;
  showCompletedTasks: boolean;
}

const DEFAULT_TASK_SETTINGS: ProfileTaskSettings = {
  taskSortOrder: "dueDate",
  showCompletedTasks: false,
};

interface UserSettingsData {
  theme: string;
  timeFormat: string;
  dateFormat: string;
  defaultZoomLevel: number;
  weekStartDay: TWeekStartDay;
  rewardSystemEnabled: boolean;
  defaultTaskPoints: number;
  showPointsOnCompletion: boolean;
  schedulerIntervalSeconds: number;
  schedulerPauseOnInteractionSeconds: number;
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
  calendarWorkingHoursStart: number;
  calendarTransitionSpeed: CalendarTransitionSpeed;
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
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? null;

  const [settings, setSettings] = useState<UserSettingsData>(initialSettings);
  const [taskSettings, setTaskSettings] = useState<ProfileTaskSettings>(
    DEFAULT_TASK_SETTINGS
  );
  const [transitionConfig, setTransitionConfig] = useState<TransitionConfig>(
    () => DEFAULT_TRANSITION_CONFIG
  );

  // Load transition config from localStorage on mount
  useEffect(() => {
    const config = loadScheduleConfig();
    setTransitionConfig(config.transition ?? DEFAULT_TRANSITION_CONFIG);
  }, []);

  // Load profile-scoped task settings whenever the active profile changes.
  useEffect(() => {
    if (!activeProfileId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/profiles/${activeProfileId}/settings`
        );
        if (!response.ok) return;
        const data = (await response.json()) as Partial<ProfileTaskSettings>;
        if (cancelled) return;
        setTaskSettings({
          taskSortOrder:
            data.taskSortOrder ?? DEFAULT_TASK_SETTINGS.taskSortOrder,
          showCompletedTasks:
            data.showCompletedTasks ?? DEFAULT_TASK_SETTINGS.showCompletedTasks,
        });
      } catch {
        // Leave defaults in place on network failure; toast is reserved for
        // user-initiated changes.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId]);

  const updateSettings = async (partial: Partial<UserSettingsData>) => {
    // Capture the pre-call value of *only* the keys we're about to overwrite,
    // read from the functional setter's current state (not a stale closure).
    // On rollback, merge those keys back so any concurrent successful PUT
    // to other keys is preserved (#363).
    let previousPartial: Partial<UserSettingsData> | undefined;
    setSettings((curr) => {
      previousPartial = Object.fromEntries(
        (Object.keys(partial) as Array<keyof UserSettingsData>).map((key) => [
          key,
          curr[key],
        ])
      ) as Partial<UserSettingsData>;
      return { ...curr, ...partial };
    });

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      // #337 — broadcast to in-tab consumers so the calendar surface
      // (`useUserSettings` in `CalendarProvider`) re-renders without
      // waiting for the next reload.
      emitUserSettingsChange(partial);
    } catch {
      toast.error("Failed to save settings");
      const revert = previousPartial;
      if (revert) {
        setSettings((curr) => ({ ...curr, ...revert }));
      }
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

  const handleTransitionChange = (updated: TransitionConfig) => {
    setTransitionConfig(updated);
    const config = loadScheduleConfig();
    saveScheduleConfig({ ...config, transition: updated });
  };

  const handleDeleteAllData = async () => {
    await handleDeleteAccount();
  };

  const updateTaskSettings = async (partial: Partial<ProfileTaskSettings>) => {
    if (!activeProfileId) {
      toast.error("No active profile — task settings cannot be saved");
      return;
    }

    const previous = taskSettings;
    const next = { ...previous, ...partial };
    setTaskSettings(next);

    try {
      const response = await fetch(
        `/api/profiles/${activeProfileId}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update task settings");
      }
    } catch {
      toast.error("Failed to save task settings");
      setTaskSettings(previous);
    }
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
          weekStartDay: settings.weekStartDay,
        }}
        onChange={updateSettings}
      />

      <SchedulerSection
        values={{
          schedulerIntervalSeconds: settings.schedulerIntervalSeconds,
          schedulerPauseOnInteractionSeconds:
            settings.schedulerPauseOnInteractionSeconds,
        }}
        onChange={updateSettings}
      />

      <CalendarSection
        values={{
          calendarRefreshIntervalMinutes:
            settings.calendarRefreshIntervalMinutes,
          calendarFetchMonthsAhead: settings.calendarFetchMonthsAhead,
          calendarFetchMonthsBehind: settings.calendarFetchMonthsBehind,
          calendarMaxEventsPerDay: settings.calendarMaxEventsPerDay,
          calendarWorkingHoursStart: settings.calendarWorkingHoursStart,
        }}
        onChange={updateSettings}
      />

      <CalendarTransitionSection
        values={{
          calendarTransitionSpeed: settings.calendarTransitionSpeed,
        }}
        onChange={updateSettings}
      />

      <TransitionSection
        values={transitionConfig}
        onChange={handleTransitionChange}
      />

      <RewardSection
        values={{
          rewardSystemEnabled: settings.rewardSystemEnabled,
          defaultTaskPoints: settings.defaultTaskPoints,
          showPointsOnCompletion: settings.showPointsOnCompletion,
        }}
        onChange={updateSettings}
      />

      <TaskSection values={taskSettings} onChange={updateTaskSettings} />

      <PrivacySection
        permissions={["Google Calendar (read)", "Google Tasks (read/write)"]}
        onDeleteAllData={handleDeleteAllData}
      />
    </div>
  );
}
