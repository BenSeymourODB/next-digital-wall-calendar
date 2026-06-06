"use client";

/**
 * TaskList - Main task list component
 *
 * Features:
 * - Header with title and settings/refresh buttons
 * - Loading, error, and empty states
 * - List of TaskItem components
 * - Task completion toggling
 * - Footer "+ Add Task" button that launches NewTaskModal
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Loader2, Plus, RefreshCw, Settings } from "lucide-react";
import { NewTaskModal } from "./new-task-modal";
import { ReauthCta } from "./reauth-cta";
import { TaskApiError } from "./task-api-error";
import { TaskItem } from "./task-item";
import { type TaskListConfig, type TaskWithMeta } from "./types";
import { useTasks } from "./use-tasks";

export interface TaskListProps {
  /** Task list configuration */
  config: TaskListConfig;
  /** Called when settings button is clicked */
  onSettingsClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function TaskList({
  config,
  onSettingsClick,
  className = "",
}: TaskListProps) {
  const { tasks, loading, error, refreshTasks, updateTask } = useTasks(config);
  const [isAddOpen, setIsAddOpen] = useState(false);
  // Toggle errors are scoped to a single PATCH and must NOT replace the
  // rendered task list (`error` from the hook does, since fetch failure
  // means we have nothing to show). A separate slot keeps them transient
  // and clears on the next successful toggle.
  const [toggleError, setToggleError] = useState<Error | null>(null);

  const handleTaskToggle = async (task: TaskWithMeta) => {
    const newStatus = task.status === "completed" ? "needsAction" : "completed";
    try {
      await updateTask(task.id, task.listId, { status: newStatus });
      setToggleError(null);
    } catch (err) {
      setToggleError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const title = config.title || "My Tasks";

  const enabledLists = config.lists.filter((list) => list.enabled);
  const defaultListId =
    enabledLists.length === 1 ? enabledLists[0].listId : undefined;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold" role="heading">
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshTasks()}
            disabled={loading}
            aria-label="Refresh tasks"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            aria-label="Task list settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Toggle-error banner — scoped to a single failed PATCH; does not
            wipe the rendered task list. */}
        {toggleError && (
          <div
            role="alert"
            className="mb-3 space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>{toggleError.message}</p>
            {toggleError instanceof TaskApiError &&
              toggleError.requiresReauth && <ReauthCta />}
          </div>
        )}

        {/* Loading state */}
        {loading && tasks.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Loading tasks...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="py-8 text-center text-red-600">
            <p>Error loading tasks</p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshTasks()}
              >
                Try again
              </Button>
              {error instanceof TaskApiError && error.requiresReauth && (
                <ReauthCta />
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && tasks.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <p>No tasks</p>
            <p className="mt-1 text-sm">
              Add a task to get started, or check your settings.
            </p>
          </div>
        )}

        {/* Task list */}
        {tasks.length > 0 && (
          <ul role="list" className="-mx-4 divide-y divide-gray-100">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskItem
                  task={task}
                  onToggle={() => handleTaskToggle(task)}
                  disabled={loading}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Add Task footer */}
        <div className="-mx-6 mt-2 border-t border-gray-100">
          <Button
            variant="ghost"
            className="w-full justify-center gap-2 rounded-none py-3 text-blue-600 hover:bg-blue-50"
            onClick={() => setIsAddOpen(true)}
            disabled={enabledLists.length === 0}
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </Button>
        </div>
      </CardContent>

      <NewTaskModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        availableLists={enabledLists}
        defaultListId={defaultListId}
        onSuccess={() => {
          refreshTasks();
        }}
      />
    </Card>
  );
}
