"use client";

/**
 * TaskItem - Individual task item component
 *
 * Features:
 * - Color indicator dot showing the task list color
 * - Checkbox for completing/uncompleting tasks
 * - Task title with strikethrough for completed tasks
 * - Due date display with overdue styling
 * - Optional notes display
 */
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { type TaskWithMeta, formatDueDate } from "./types";

export interface TaskItemProps {
  /** The task to display */
  task: TaskWithMeta;
  /** Called when the task checkbox is toggled */
  onToggle: () => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
}

export function TaskItem({ task, onToggle, disabled = false }: TaskItemProps) {
  const isCompleted = task.status === "completed";

  return (
    <div className="p-4 transition hover:bg-gray-50">
      <div className="flex items-start gap-3">
        {/* Color indicator dot */}
        <div
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: task.listColor }}
          title={task.listTitle}
          aria-hidden="true"
        />

        {/* Checkbox */}
        <Checkbox
          id={`task-${task.id}`}
          checked={isCompleted}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label={task.title}
          className="mt-0.5 flex-shrink-0"
        />

        {/* Task content */}
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`task-${task.id}`}
            className={cn(
              "block cursor-pointer text-gray-900",
              isCompleted && "text-gray-500 line-through"
            )}
          >
            {task.title}
          </label>

          {task.due && (
            <div
              className={cn(
                "mt-1 text-sm",
                task.isOverdue ? "font-medium text-red-600" : "text-gray-500"
              )}
            >
              Due: {formatDueDate(task.due)}
            </div>
          )}

          {task.notes && (
            <div className="mt-1 line-clamp-2 text-sm text-gray-600">
              {task.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
