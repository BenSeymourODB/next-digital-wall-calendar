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
 *
 * A live-mode list picker is always shown below the static fixture.
 * Its selection is persisted to localStorage ("test-tasks.live-list")
 * so it survives page reloads during repeated manual testing (#289).
 */
import { TaskList } from "@/components/tasks/task-list";
import type { TaskListConfig } from "@/components/tasks/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Suspense, useEffect, useState } from "react";
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

/** localStorage key for the live-mode list picker selection */
export const LIVE_LIST_LS_KEY = "test-tasks.live-list";

interface GoogleTaskListItem {
  id: string;
  title: string;
  updated: string;
}

/**
 * Live-mode section: fetches real task lists from /api/tasks/lists and lets
 * the tester pick one. Selection is persisted to localStorage.
 */
function LiveListPicker() {
  const [lists, setLists] = useState<GoogleTaskListItem[]>([]);
  const [savedListId, setSavedListId] = useLocalStorage<string>(
    LIVE_LIST_LS_KEY,
    ""
  );

  useEffect(() => {
    fetch("/api/tasks/lists")
      .then((res) => res.json())
      .then((data: { lists: GoogleTaskListItem[] }) => {
        setLists(data.lists ?? []);
      })
      .catch(() => {
        // silently ignore fetch errors on the test page
      });
  }, []);

  // Validate the restored id against the fetched lists; fall back to "" if stale
  const availableIds = lists.map((l) => l.id);
  const validatedId =
    savedListId !== "" && availableIds.includes(savedListId) ? savedListId : "";

  const liveConfig: TaskListConfig = {
    id: "test-live",
    title: "Live Tasks",
    showCompleted: false,
    sortBy: "dueDate",
    lists: validatedId
      ? [
          {
            listId: validatedId,
            listTitle:
              lists.find((l) => l.id === validatedId)?.title ?? validatedId,
            color: "#3b82f6",
            enabled: true,
          },
        ]
      : [],
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <h2 className="mb-3 text-lg font-semibold text-gray-800">
        Live Mode (real API)
      </h2>
      <div className="mb-4 flex items-center gap-3">
        <label
          htmlFor="live-list-picker"
          className="text-sm font-medium text-gray-700"
        >
          Live list
        </label>
        <select
          id="live-list-picker"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          value={validatedId}
          onChange={(e) => setSavedListId(e.target.value)}
          aria-label="Live list"
        >
          <option value="">— select a list —</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
      </div>
      {validatedId && <TaskList config={liveConfig} />}
    </div>
  );
}

function TestTasksContent() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("lists") === "multi" ? "multi" : "single";
  const config = variant === "multi" ? MULTI_LIST_CONFIG : SINGLE_LIST_CONFIG;

  return (
    <div className="container mx-auto max-w-md p-4" data-testid="test-tasks">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Tasks Test Page</h1>
      <TaskList config={config} />
      <LiveListPicker />
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
