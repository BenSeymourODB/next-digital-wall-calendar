import { type Page, type Route, expect, test } from "@playwright/test";

/**
 * E2E for the live mode of /test/tasks (#236).
 *
 * The default URL (`/test/tasks` with no query param) fetches the
 * user's real task lists from `/api/tasks/lists`, auto-selects the
 * first, and exposes a `<select>` picker. We intercept both
 * `/api/tasks/lists` and `/api/tasks*` so the suite runs without a
 * Google session, and capture video so the PR can visually document
 * the loading → ready → switch flow.
 */

test.use({ video: "on" });

interface MockGoogleTaskList {
  id: string;
  title: string;
}

async function mockLiveListsApi(
  page: Page,
  options: {
    lists?: MockGoogleTaskList[] | "fail";
    tasksByListId?: Record<string, Array<{ id: string; title: string }>>;
  } = {}
): Promise<{ failNextLists: () => void; getListsRequestCount: () => number }> {
  let listsRequestCount = 0;
  let failNext = false;
  const tasksByListId = options.tasksByListId ?? {};

  const fulfillJson = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/tasks/lists", async (route) => {
    listsRequestCount += 1;

    if (options.lists === "fail" || failNext) {
      failNext = false;
      await fulfillJson(route, 500, { error: "boom" });
      return;
    }

    await fulfillJson(route, 200, { lists: options.lists ?? [] });
  });

  await page.route("**/api/tasks*", async (route) => {
    const url = new URL(route.request().url());

    // Tasks query — return tasks for the requested listId
    if (url.pathname === "/api/tasks" && route.request().method() === "GET") {
      const listId = url.searchParams.get("listId") ?? "";
      const tasks = tasksByListId[listId] ?? [];
      await fulfillJson(route, 200, {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: "needsAction",
          updated: new Date().toISOString(),
          position: "00000000000000000000",
        })),
      });
      return;
    }

    // Anything else — let through (page.route() unmocked = network).
    await route.continue();
  });

  return {
    failNextLists: () => {
      failNext = true;
    },
    getListsRequestCount: () => listsRequestCount,
  };
}

test.describe("/test/tasks live mode", () => {
  test("auto-selects the first list and renders its tasks", async ({
    page,
  }) => {
    await mockLiveListsApi(page, {
      lists: [
        { id: "list-personal", title: "Personal" },
        { id: "list-work", title: "Work" },
      ],
      tasksByListId: {
        "list-personal": [{ id: "t1", title: "Personal task" }],
        "list-work": [{ id: "t2", title: "Work task" }],
      },
    });

    await page.goto("/test/tasks");

    // The loading skeleton is asserted in the Vitest unit tests where we
    // can pause the fetch deterministically. In Playwright the skeleton
    // can flash for less than a frame on a fast CI runner, so we go
    // straight to asserting the steady-state UI.
    await expect(page.getByTestId("test-tasks-live-ready")).toBeVisible();
    const picker = page.getByTestId("test-tasks-live-picker");
    await expect(picker).toHaveValue("list-personal");

    // The TaskList for the auto-selected list renders its task.
    await expect(page.getByText("Personal task")).toBeVisible();
  });

  test("switching the picker fetches tasks for the chosen list", async ({
    page,
  }) => {
    await mockLiveListsApi(page, {
      lists: [
        { id: "list-personal", title: "Personal" },
        { id: "list-work", title: "Work" },
      ],
      tasksByListId: {
        "list-personal": [{ id: "t1", title: "Personal task" }],
        "list-work": [{ id: "t2", title: "Work task" }],
      },
    });

    await page.goto("/test/tasks");

    await expect(page.getByText("Personal task")).toBeVisible();

    await page.getByTestId("test-tasks-live-picker").selectOption("list-work");

    await expect(page.getByText("Work task")).toBeVisible();
    await expect(page.getByText("Personal task")).not.toBeVisible();
  });

  test("shows the empty state when the user has no task lists", async ({
    page,
  }) => {
    await mockLiveListsApi(page, { lists: [] });

    await page.goto("/test/tasks");

    const empty = page.getByTestId("test-tasks-live-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/no task lists/i);

    // Picker is not rendered when there are no lists.
    await expect(page.getByTestId("test-tasks-live-picker")).toHaveCount(0);
  });

  test("shows the error state with a working retry when the fetch fails", async ({
    page,
  }) => {
    let listsCallCount = 0;

    await page.route("**/api/tasks/lists", async (route) => {
      listsCallCount += 1;
      if (listsCallCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "boom" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          lists: [{ id: "list-recovered", title: "Recovered" }],
        }),
      });
    });

    // Tasks endpoint just needs to return empty so TaskList doesn't error.
    await page.route("**/api/tasks*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/tasks") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ tasks: [] }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/test/tasks");

    const error = page.getByTestId("test-tasks-live-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/couldn.?t load your task lists/i);

    await page.getByRole("button", { name: /try again/i }).click();

    await expect(page.getByTestId("test-tasks-live-ready")).toBeVisible();
    await expect(page.getByTestId("test-tasks-live-picker")).toHaveValue(
      "list-recovered"
    );
    expect(listsCallCount).toBeGreaterThanOrEqual(2);
  });

  test("renders the reauth state with a Sign-in link when the API requires reauth", async ({
    page,
  }) => {
    await page.route("**/api/tasks/lists", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Missing Google Tasks scope. Please sign in again.",
          requiresReauth: true,
        }),
      });
    });

    await page.goto("/test/tasks");

    const reauth = page.getByTestId("test-tasks-live-reauth");
    await expect(reauth).toBeVisible();
    await expect(reauth).toContainText(/sign in again/i);
    // Critical: the generic "Try again" button must NOT render in this
    // state — clicking it would refire the same 401 in a loop.
    await expect(page.getByRole("button", { name: /try again/i })).toHaveCount(
      0
    );
    await expect(
      page.getByRole("link", { name: /sign in again/i })
    ).toHaveAttribute("href", "/api/auth/signin");
  });

  test("mock-harness ?lists=single still renders the existing single-list mock", async ({
    page,
  }) => {
    // Live mode would call /api/tasks/lists; assert it is NOT called by
    // setting up a route that fails the test if hit.
    let listsCalled = false;
    await page.route("**/api/tasks/lists", async (route) => {
      listsCalled = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "should-not-be-called" }),
      });
    });

    await page.route("**/api/tasks*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/tasks") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ tasks: [] }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/test/tasks?lists=single");

    await expect(page.getByTestId("test-tasks-mode-banner")).toContainText(
      /\?lists=single/
    );
    expect(listsCalled).toBe(false);

    // The single-list mock harness renders the TaskList card.
    await expect(
      page.getByRole("heading", { name: /my tasks/i })
    ).toBeVisible();
  });
});
