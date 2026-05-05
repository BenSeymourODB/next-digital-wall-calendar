/**
 * Tasks components barrel export
 */
export { TaskAssignmentPicker } from "./task-assignment-picker";
export type {
  ProfileInfo,
  TaskAssignmentPickerProps,
} from "./task-assignment-picker";

export { TaskItem } from "./task-item";
export type { TaskItemProps } from "./task-item";

export { TaskList } from "./task-list";
export type { TaskListProps } from "./task-list";

export { ProfileScopedTaskList } from "./profile-scoped-task-list";
export type { ProfileScopedTaskListProps } from "./profile-scoped-task-list";

export { TaskListSettings } from "./task-list-settings";
export type { TaskListSettingsProps } from "./task-list-settings";

export { useTasks } from "./use-tasks";
export type { UseTasksReturn } from "./use-tasks";

// `parseTaskApiError` is intentionally not re-exported — it's an internal
// fetch-response parser coupled to the route contract; only `TaskApiError`
// (the class consumers need for `instanceof` checks) is public.
export { TaskApiError } from "./task-api-error";

export { ReauthCta } from "./reauth-cta";
export type { ReauthCtaProps } from "./reauth-cta";

export {
  DEFAULT_LIST_COLORS,
  formatDueDate,
  isTaskOverdue,
  sortTasks,
} from "./types";
export type {
  GoogleTask,
  GoogleTaskList,
  TaskListConfig,
  TaskListSelection,
  TaskListsApiResponse,
  TaskSortOption,
  TasksApiResponse,
  TaskWithMeta,
} from "./types";
