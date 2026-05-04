"use client";

/**
 * E2E test surface for TaskList + NewTaskModal (#165).
 *
 * Renders TaskList with a hard-coded config so Playwright can exercise
 * the open → fill → submit flow against `page.route()` interception of
 * `/api/tasks*`. No auth, no real Google API.
 *
 * Query params:
 * - `lists=single` (default) renders one enabled list — exercises the
 *   smart-default pre-selection.
 * - `lists=multi` renders two enabled lists — exercises the
 *   no-default-selected branch.
 */
import { TaskList } from "@/components/tasks/task-list";
import type { TaskListConfig } from "@/components/tasks/types";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const SINGLE_LIST_CONFIG: TaskListConfig = {
  id: "test-single",
  title: "My Tasks",
  showCompleted: false,
  sortBy: "dueDate",
  lists: [
    {
      listId: "list-groceries",
      listTitle: "Groceries",
      color: "#ef4444",
      enabled: true,
    },
  ],
};

const MULTI_LIST_CONFIG: TaskListConfig = {
  id: "test-multi",
  title: "My Tasks",
  showCompleted: false,
  sortBy: "dueDate",
  lists: [
    {
      listId: "list-groceries",
      listTitle: "Groceries",
      color: "#ef4444",
      enabled: true,
    },
    {
      listId: "list-work",
      listTitle: "Work",
      color: "#3b82f6",
      enabled: true,
    },
  ],
};

function TestTasksContent() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("lists") === "multi" ? "multi" : "single";
  const config = variant === "multi" ? MULTI_LIST_CONFIG : SINGLE_LIST_CONFIG;

  return (
    <div className="container mx-auto max-w-md p-4" data-testid="test-tasks">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Tasks Test Page</h1>
      <TaskList config={config} />
    </div>
  );
}

export default function TestTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-4">Loading test page...</div>
      }
    >
      <TestTasksContent />
    </Suspense>
  );
}
