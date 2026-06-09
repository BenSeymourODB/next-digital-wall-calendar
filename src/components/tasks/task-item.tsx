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
 * - Profile assignment avatars when the task is owned by one or more
 *   family profiles
 * - Reward-point integration: when wrapped in `PointsProvider` and the
 *   user has rewards enabled, completing the task POSTs to
 *   `/api/points/award` (idempotent server-side via the unique
 *   `(profileId, taskId, reason)` index) and surfaces a transient
 *   `PointsAnimation` if `showPointsOnCompletion` is true.
 */
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { PointsAnimation } from "@/components/rewards/points-animation";
import { usePointsOptional } from "@/components/rewards/points-context";
import { Checkbox } from "@/components/ui/checkbox";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { type TaskWithMeta, formatDueDate } from "./types";

export interface TaskItemProps {
  /** The task to display */
  task: TaskWithMeta;
  /** Called when the task checkbox is toggled. May return a Promise. */
  onToggle: () => void | Promise<void>;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
}

export function TaskItem({ task, onToggle, disabled = false }: TaskItemProps) {
  const isCompleted = task.status === "completed";
  const assignees = task.assignments;
  const points = usePointsOptional();

  const [animationPoints, setAnimationPoints] = useState<number | null>(null);

  const handleToggle = async () => {
    // Captured before the async toggle: React may re-render TaskItem
    // with the updated task.status before this closure resumes, so we
    // can't rely on `isCompleted` after the await to know the direction.
    const wasCompleted = isCompleted;

    // Always run the parent's toggle first — that's the source of truth
    // for the task's status. Whatever happens with rewards is layered on
    // top and must never replace the underlying toggle behaviour.
    await Promise.resolve(onToggle());

    // Award points only on the incomplete → complete transition.
    if (wasCompleted) return;
    if (!points || !points.isEnabled) return;

    try {
      const result = await points.awardPoints(
        points.defaultTaskPoints,
        "task_completed",
        { taskId: task.id, taskTitle: task.title }
      );

      // alreadyAwarded means the server's unique index fired — re-completing
      // the same task does not re-credit, so we suppress the animation too.
      if (!result.alreadyAwarded && points.showPointsOnCompletion) {
        setAnimationPoints(points.defaultTaskPoints);
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "TaskAwardPointsFailed",
        taskId: task.id,
      });
    }
  };

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
          onCheckedChange={handleToggle}
          disabled={disabled}
          aria-label={task.title}
          className="mt-0.5 flex-shrink-0"
        />

        {/* Task content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <label
              htmlFor={`task-${task.id}`}
              className={cn(
                "block cursor-pointer text-gray-900",
                isCompleted && "text-gray-500 line-through"
              )}
            >
              {task.title}
            </label>

            {assignees.length > 0 && (
              <div
                role="group"
                aria-label={`Assigned to ${assignees
                  .map((a) => a.profile.name)
                  .join(", ")}`}
                className="flex flex-shrink-0 -space-x-1"
              >
                {assignees.map((a) => (
                  <ProfileAvatar
                    key={a.profileId}
                    profile={a.profile}
                    size="sm"
                  />
                ))}
              </div>
            )}
          </div>

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

          <PointsAnimation
            points={animationPoints ?? 0}
            show={animationPoints !== null}
            onComplete={() => setAnimationPoints(null)}
          />
        </div>
      </div>
    </div>
  );
}
