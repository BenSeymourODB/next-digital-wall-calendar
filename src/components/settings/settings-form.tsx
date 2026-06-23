"use client";

import { useProfile } from "@/components/profiles/profile-context";
import type { TransitionConfig } from "@/components/scheduler/types";
import { DEFAULT_TRANSITION_CONFIG } from "@/lib/scheduler/schedule-config";
import {
  loadScheduleConfig,
  saveScheduleConfig,
} from "@/lib/scheduler/schedule-storage";
import {
  type UserSettingsPartial,
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import type { UserSettingsData } from "@/types/user-settings";
import { useEffect, useRef, useState } from "react";
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

  // Mirror of `settings` for the rollback path to read after the optimistic
  // render commits (#420). Reading the live state outside the `setSettings`
  // functional callback lets us compare-and-swap per-key without emitting
  // from inside the setter (which double-fires under StrictMode).
  //
  // The ref is updated in a `useEffect`, which runs after commit but before
  // the next render. UI-triggered `updateSettings` calls are always separated
  // by at least one event-loop tick (the user clicks again after the previous
  // click's handler returns), so by the time a concurrent `catch` fires the
  // ref reflects every preceding optimistic write. A synchronous same-tick
  // race (e.g. programmatic rapid-fire) would not be guarded — see the
  // analogous pattern at `useUserSettings.ts:104`.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // #424 — subscribe to the in-tab user-settings bus so a write from
  // any other surface (calendar settings popover, tasks settings panel,
  // sync fixtures) merges into the form's local state. Without this
  // subscription the form was a publisher-only consumer and would drift
  // from `useUserSettings.settings` the moment a second writer landed in
  // the same tab — `AccountSection`'s `dateFormat` prop is the most
  // visible drift today.
  //
  // The merge is a no-op for the form's own emits (the values are
  // already present in `prev`), so the round-trip from
  // `updateSettings → emitUserSettingsChange → subscribe → setSettings`
  // costs at most one extra render and never re-PUTs. Mirrors the
  // pattern at `useUserSettings.ts:177-185`.
  useEffect(() => {
    return subscribeUserSettings((partial) => {
      const picked = pickSettingsBusFields(partial);
      if (Object.keys(picked).length === 0) return;
      setSettings((prev) => ({ ...prev, ...picked }));
    });
  }, []);

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
      // The cast is sound because `Object.keys(partial)` is bounded by
      // `partial`'s `Partial<UserSettingsData>` type — no extraneous keys
      // can enter the snapshot.
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
      if (!revert) return;

      // #420 — compare-and-swap rollback. For each key in `revert`, only
      // restore the pre-call value if the live state still matches this
      // call's optimistic value. A later call that overwrote the same key
      // (its PUT succeeded after we snapshotted but before we failed) must
      // not be regressed to our stale snapshot. Reads through `settingsRef`
      // so the comparison sees the truly-current state, post-render.
      //
      // `Object.is` is the correct comparator for the current all-primitive
      // shape of `UserSettingsData`. If a future field becomes an array or
      // object reference, the comparison would degenerate to reference
      // equality and the guard would never fire — switch to a structural
      // comparator at that point.
      const live = settingsRef.current;
      const liveRevert: Partial<UserSettingsData> = {};
      for (const key of Object.keys(revert) as Array<keyof UserSettingsData>) {
        if (Object.is(live[key], partial[key])) {
          (liveRevert as Record<string, unknown>)[key] = revert[key];
        }
      }

      if (Object.keys(liveRevert).length === 0) return;

      setSettings((curr) => ({ ...curr, ...liveRevert }));
      // #414 — pair the local rollback with a bus emit so in-tab
      // subscribers (e.g. `CalendarProvider` via `useUserSettings`)
      // converge on the rolled-back value rather than holding any
      // earlier optimistic value they may have consumed.
      emitUserSettingsChange(liveRevert);
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

    // Capture the pre-call value of *only* the keys we're about to overwrite,
    // read from the functional setter's current state (not a stale closure).
    // On rollback, merge those keys back so any concurrent successful PUT
    // to other task-settings keys is preserved (#413, mirrors #363/#366).
    let previousPartial: Partial<ProfileTaskSettings> | undefined;
    setTaskSettings((curr) => {
      previousPartial = Object.fromEntries(
        (Object.keys(partial) as Array<keyof ProfileTaskSettings>).map(
          (key) => [key, curr[key]]
        )
      ) as Partial<ProfileTaskSettings>;
      return { ...curr, ...partial };
    });

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
      const revert = previousPartial;
      if (revert) {
        setTaskSettings((curr) => ({ ...curr, ...revert }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <AccountSection
        user={user}
        createdAt={createdAt}
        providers={providers}
        onDeleteAccount={handleDeleteAccount}
        dateFormat={settings.dateFormat}
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

// Trim `undefined` values off a bus partial. The bus payload type is
// `Partial<UserSettingsData>`, which structurally matches the form's
// `settings` shape — no key-level value narrowing is needed (unlike
// `useUserSettings.pickCalendarFields`, which guards against the
// `/api/settings` GET shipping rogue values from a stale DB row). The
// only thing we strip is explicit `undefined`s, since spreading them
// into local state would overwrite valid fields with `undefined`.
function pickSettingsBusFields(
  partial: UserSettingsPartial
): Partial<UserSettingsData> {
  const picked: Partial<UserSettingsData> = {};
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) {
      (picked as Record<string, unknown>)[key] = value;
    }
  }
  return picked;
}
