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
 *
 * The live-mode picker selection is persisted to localStorage under
 * `LIVE_LIST_LS_KEY` so it survives reloads (#289). Stale ids that no
 * longer match a fetched list fall back to `lists[0]` via the
 * `selectedList = lists.find(...) ?? lists[0]` resolver below.
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
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// The `/api/tasks*` 401/403 error envelope (defined in `task-api-error.ts`).
// The class form (`TaskApiError`) is consumed by the production hooks via
// `instanceof`; the parsed JSON body here just needs the `requiresReauth`
// flag, so a tiny structural type keeps this page free of the class import.
interface TaskApiErrorBody {
  error?: string;
  requiresReauth?: boolean;
}

/** localStorage key for the live-mode picker selection (introduced in #289). */
export const LIVE_LIST_LS_KEY = "test-tasks.live-list";

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

type LiveStatus = "loading" | "error" | "reauth" | "ready";

function LiveTasksPanel() {
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [lists, setLists] = useState<GoogleTaskList[]>([]);
  // Persist the picker selection across reloads (#289). The fallback when
  // the persisted id is missing or stale is handled by `selectedList` below,
  // which resolves to `lists[0]` whenever `selectedListId` doesn't match
  // a fetched list — so the on-fetch path no longer needs to seed the id.
  const [selectedListId, setSelectedListId] = useLocalStorage<string>(
    LIVE_LIST_LS_KEY,
    ""
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/tasks/lists")
      .then(async (response) => {
        if (!response.ok) {
          // The error body may be missing or non-JSON (e.g. an HTML 502
          // from a proxy); guard the parse so a transient gateway error
          // doesn't crash the panel. The `requiresReauth` flag from the
          // API tells us a retry is futile — the user has to re-grant
          // the Google Tasks scope before any future request can succeed.
          let body: TaskApiErrorBody | null = null;
          try {
            body = (await response.json()) as TaskApiErrorBody;
          } catch {
            body = null;
          }
          if (cancelled) return;
          setStatus(body?.requiresReauth ? "reauth" : "error");
          return;
        }
        // The fetch promise has resolved but `json()` is still streaming
        // the body; if the component unmounts in this window the second
        // guard below catches it. We intentionally do not abort the
        // underlying request — the body parse is cheap and the response
        // is already in transit.
        const data = (await response.json()) as TaskListsApiResponse;
        if (cancelled) return;
        const fetched = data.lists ?? [];
        setLists(fetched);
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

  if (status === "reauth") {
    return (
      <Card data-testid="test-tasks-live-reauth">
        <CardHeader>
          <CardTitle className="text-base">
            Sign in again to access Google Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Your session has expired or is missing the Google Tasks scope.
            Retrying the request will hit the same error — you need to grant
            access again.
          </p>
          <Button asChild variant="secondary">
            <Link href="/api/auth/signin">Sign in again</Link>
          </Button>
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
            The request to <code>/api/tasks/lists</code> failed. This is usually
            a transient network or server issue — try again in a moment.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setStatus("loading");
              // Don't clobber the persisted picker selection on retry —
              // the stale-id fallback (`selectedList ?? lists[0]`) already
              // protects against a missing list, and clearing here would
              // surprise the user by forgetting their saved choice after
              // a transient gateway error.
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

  // Resolve the rendered list from the selected id; fall back to the first
  // list if the selection is stale (e.g. a previously-selected list was
  // deleted between fetches). The `<select value>` is driven by
  // `selectedList.id` rather than `selectedListId` so the picker can never
  // visually disagree with what TaskList renders.
  const selectedList =
    lists.find((list) => list.id === selectedListId) ?? lists[0];
  const selectedIndex = lists.indexOf(selectedList);
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
          value={selectedList.id}
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
