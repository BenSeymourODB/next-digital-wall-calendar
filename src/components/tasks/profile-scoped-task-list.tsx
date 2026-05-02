"use client";

/**
 * ProfileScopedTaskList β€" wraps `TaskList` and derives the per-profile
 * filter from the surrounding `ProfileProvider`.
 *
 * - In `viewMode === "profile"` it scopes the list to the active
 *   profile's ID. Unassigned tasks are surfaced when `showUnassigned`
 *   is `true`.
 * - In `viewMode === "family"` no profile filter is applied β€" the
 *   list shows everything.
 *
 * Caller-supplied `profileFilter`/`showUnassigned` overrides on
 * `config` win β€" the wrapper only fills in defaults when those fields
 * are `undefined`. Returning a plain `<TaskList>` keeps tests for the
 * underlying component fully decoupled from `useProfile`.
 */
import { useProfile } from "@/components/profiles/profile-context";
import { TaskList, type TaskListProps } from "./task-list";
import { type TaskListConfig } from "./types";

export interface ProfileScopedTaskListProps extends Omit<
  TaskListProps,
  "config"
> {
  config: TaskListConfig;
  /**
   * When the active profile owns the task list, also surface tasks
   * that have no assignees. Defaults to `true` β€" family chores
   * without a specific owner stay visible.
   */
  showUnassigned?: boolean;
}

export function ProfileScopedTaskList({
  config,
  showUnassigned = true,
  ...rest
}: ProfileScopedTaskListProps) {
  const { activeProfile, viewMode } = useProfile();

  const effectiveConfig: TaskListConfig =
    viewMode === "family" || !activeProfile
      ? { ...config, profileFilter: null }
      : {
          ...config,
          profileFilter: config.profileFilter ?? activeProfile.id,
          showUnassigned: config.showUnassigned ?? showUnassigned,
        };

  return <TaskList {...rest} config={effectiveConfig} />;
}
