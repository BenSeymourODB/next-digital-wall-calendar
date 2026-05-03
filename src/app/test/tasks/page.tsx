"use client";

/**
 * E2E + manual test surface for TaskList + NewTaskModal.
 *
 * Three modes resolved from `?lists=`:
 * - `?lists=single` — hard-coded single-list mock harness (existing
 *   Playwright suites intercept `/api/tasks*` against this).
 * - `?lists=multi`  — hard-coded multi-list mock harness.
 * - default         — live mode: fetches the user's real task lists from
 *                     `/api/tasks/lists`, auto-selects the first, and
 *                     exposes a picker so they can switch between lists.
 *                     Renders loading / error / empty states. (#236)
 */
import { TaskList } from "@/components/tasks/task-list";
import {
  DEFAULT_LIST_COLORS,
  type GoogleTaskList,
  type TaskListConfig,
  type TaskListsApiResponse,
} from "@/components/tasks/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

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

function buildLiveConfig(list: GoogleTaskList, color: string): TaskListConfig {
  return {
    id: `test-live-${list.id}`,
    title: "My Tasks",
    showCompleted: false,
    sortBy: "dueDate",
    lists: [
      {
        listId: list.id,
        listTitle: list.title,
        color,
        enabled: true,
      },
    ],
  };
}

type LiveStatus = "loading" | "error" | "ready";

function LiveTasksPanel() {
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [lists, setLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/tasks/lists")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setStatus("error");
          return;
        }
        const data = (await response.json()) as TaskListsApiResponse;
        if (cancelled) return;
        const fetched = data.lists ?? [];
        setLists(fetched);
        setSelectedListId(fetched[0]?.id ?? "");
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (status === "loading") {
    return (
      <Card data-testid="test-tasks-live-loading">
        <CardContent className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading your task lists…
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card data-testid="test-tasks-live-error">
        <CardHeader>
          <CardTitle className="text-base">
            Couldn&rsquo;t load your task lists
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            The request to <code>/api/tasks/lists</code> failed. This usually
            means the session is missing the Google Tasks scope; sign out and
            back in to re-grant access.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setStatus("loading");
              setReloadToken((token) => token + 1);
            }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (lists.length === 0) {
    return (
      <Card data-testid="test-tasks-live-empty">
        <CardHeader>
          <CardTitle className="text-base">
            No task lists on this account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            You haven&rsquo;t created any task lists in Google Tasks yet. Create
            one (e.g.&nbsp;in the Google Tasks side panel of Gmail or Calendar)
            and then refresh this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedIndex = Math.max(
    0,
    lists.findIndex((list) => list.id === selectedListId)
  );
  const selectedList = lists[selectedIndex];
  const color = DEFAULT_LIST_COLORS[selectedIndex % DEFAULT_LIST_COLORS.length];

  return (
    <div className="space-y-4" data-testid="test-tasks-live-ready">
      <div className="space-y-1">
        <label
          htmlFor="test-tasks-live-picker"
          className="text-sm font-medium text-gray-700"
        >
          Task list
        </label>
        <select
          id="test-tasks-live-picker"
          data-testid="test-tasks-live-picker"
          value={selectedListId}
          onChange={(event) => setSelectedListId(event.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
      </div>
      <TaskList config={buildLiveConfig(selectedList, color)} />
    </div>
  );
}

function TestTasksContent() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("lists");

  if (variant === "single") {
    return (
      <div className="container mx-auto max-w-md p-4" data-testid="test-tasks">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Tasks Test Page
        </h1>
        <p
          className="mb-3 text-xs text-gray-500"
          data-testid="test-tasks-mode-banner"
        >
          Mock harness mode: <code>?lists=single</code>
        </p>
        <TaskList config={SINGLE_LIST_CONFIG} />
      </div>
    );
  }

  if (variant === "multi") {
    return (
      <div className="container mx-auto max-w-md p-4" data-testid="test-tasks">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Tasks Test Page
        </h1>
        <p
          className="mb-3 text-xs text-gray-500"
          data-testid="test-tasks-mode-banner"
        >
          Mock harness mode: <code>?lists=multi</code>
        </p>
        <TaskList config={MULTI_LIST_CONFIG} />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md p-4" data-testid="test-tasks">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Tasks Test Page</h1>
      <LiveTasksPanel />
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
