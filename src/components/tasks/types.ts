/**
 * TypeScript types for Google Tasks components
 */

/**
 * Task from Google Tasks API
 * See: https://developers.google.com/tasks/reference/rest/v1/tasks
 */
export interface GoogleTask {
  /** Task identifier */
  id: string;
  /** Task title */
  title: string;
  /** Notes describing the task */
  notes?: string;
  /** Task status: "needsAction" for incomplete, "completed" for done */
  status: "needsAction" | "completed";
  /** Due date in RFC 3339 format (e.g., "2024-01-15T00:00:00.000Z") */
  due?: string;
  /** Last modification time in RFC 3339 format */
  updated: string;
  /** Parent task identifier (for subtasks) */
  parent?: string;
  /** Position of the task among sibling tasks (for ordering) */
  position: string;
  /** Completion time in RFC 3339 format (only set if status is "completed") */
  completed?: string;
  /** Flag indicating whether the task is deleted */
  deleted?: boolean;
  /** Flag indicating whether the task is hidden */
  hidden?: boolean;
  /** Collection of links attached to the task */
  links?: TaskLink[];
}

/**
 * Link attached to a task
 */
export interface TaskLink {
  /** Type of the link (e.g., "email") */
  type: string;
  /** Description of the link */
  description?: string;
  /** The URL */
  link: string;
}

/**
 * Task list from Google Tasks API
 * See: https://developers.google.com/tasks/reference/rest/v1/tasklists
 */
export interface GoogleTaskList {
  /** Task list identifier */
  id: string;
  /** Task list title */
  title: string;
  /** Last modification time in RFC 3339 format */
  updated: string;
}

/**
 * Configuration for a task list selection in the component
 */
export interface TaskListSelection {
  /** Google task list ID */
  listId: string;
  /** Display title of the list */
  listTitle: string;
  /** Color associated with this list (hex code) */
  color: string;
  /** Whether this list is enabled for display */
  enabled: boolean;
}

/**
 * Configuration for the TaskList component
 * Stored in localStorage/database
 */
export interface TaskListConfig {
  /** Unique identifier for this configuration */
  id: string;
  /** Custom title for the component (default: "My Tasks") */
  title?: string;
  /** Selected task lists with their configurations */
  lists: TaskListSelection[];
  /** Whether to show completed tasks */
  showCompleted: boolean;
  /** Sort order for tasks */
  sortBy: TaskSortOption;
}

/**
 * Sort options for tasks
 */
export type TaskSortOption = "dueDate" | "created" | "manual";

/**
 * Task with additional display metadata
 * Used internally by components for rendering
 */
export interface TaskWithMeta extends GoogleTask {
  /** ID of the task list this task belongs to */
  listId: string;
  /** Title of the task list this task belongs to */
  listTitle: string;
  /** Color associated with this task's list */
  listColor: string;
  /** Whether the task is overdue (computed from due date) */
  isOverdue: boolean;
}

/**
 * Default configuration for new TaskList components
 */
export const DEFAULT_TASK_LIST_CONFIG: Omit<TaskListConfig, "id" | "lists"> = {
  title: "My Tasks",
  showCompleted: false,
  sortBy: "dueDate",
};

/**
 * Default colors for task lists
 */
export const DEFAULT_LIST_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
] as const;

/**
 * Helper function to check if a task is overdue
 */
export function isTaskOverdue(task: GoogleTask): boolean {
  if (!task.due || task.status === "completed") {
    return false;
  }
  const dueDate = new Date(task.due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

/**
 * Helper function to format a due date for display
 */
export function formatDueDate(dueDate: string): string {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === today.getTime()) {
    return "Today";
  }
  if (dueDay.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }
  if (dueDay.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  // Format as "Mon, Jan 15" or similar
  return due.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Helper function to sort tasks
 */
export function sortTasks(
  tasks: TaskWithMeta[],
  sortBy: TaskSortOption
): TaskWithMeta[] {
  const sorted = [...tasks];

  switch (sortBy) {
    case "dueDate":
      return sorted.sort((a, b) => {
        // Tasks without due dates go to the end
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      });

    case "created":
      return sorted.sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
      );

    case "manual":
      // Use position field from Google Tasks (lexicographic order)
      return sorted.sort((a, b) => a.position.localeCompare(b.position));

    default:
      return sorted;
  }
}

/**
 * API response types
 */
export interface TasksApiResponse {
  tasks: GoogleTask[];
  nextPageToken?: string;
}

export interface TaskListsApiResponse {
  lists: GoogleTaskList[];
}

export interface TaskApiResponse {
  task: GoogleTask;
}

export interface TaskApiError {
  error: string;
  requiresReauth?: boolean;
}
