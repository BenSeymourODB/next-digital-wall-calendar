import { type Page, type Route, expect, test } from "@playwright/test";

/**
 * E2E for the NewTaskModal launched from the TaskList footer (#165).
 *
 * Exercises the open → fill → submit flow against the `/test/tasks`
 * harness. `/api/tasks` is fully intercepted via `page.route()` so the
 * test runs without a Google session. Video capture is enabled so the
 * PR can visually document the flow.
 */

test.use({ video: "retain-on-failure" });

interface MockTask {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  updated: string;
  position: string;
  due?: string;
  notes?: string;
}

/**
 * Wire `/api/tasks*` to in-memory mock state. Each test gets a fresh
 * store so order doesn't matter and assertions about created tasks are
 * scoped per-test.
 */
async function mockTasksApi(
  page: Page,
  initialTasks: MockTask[] = []
): Promise<{
  created: MockTask[];
  setNextPostFailure: (status: number, body?: unknown) => void;
}> {
  const tasks: MockTask[] = [...initialTasks];
  const created: MockTask[] = [];
  let nextPostFailure: { status: number; body: unknown } | null = null;

  const fulfillJson = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/tasks**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === "/api/tasks" && method === "GET") {
      await fulfillJson(route, 200, { tasks });
      return;
    }

    if (url.pathname === "/api/tasks" && method === "POST") {
      if (nextPostFailure) {
        const failure = nextPostFailure;
        nextPostFailure = null;
        await fulfillJson(route, failure.status, failure.body);
        return;
      }
      const body = (route.request().postDataJSON() ?? {}) as {
        title?: string;
        listId?: string;
        due?: string;
        notes?: string;
      };
      const newTask: MockTask = {
        id: `srv-${created.length + 1}`,
        title: body.title ?? "",
        status: "needsAction",
        updated: new Date().toISOString(),
        position: String(tasks.length).padStart(20, "0"),
        ...(body.due ? { due: body.due } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      };
      created.push(newTask);
      tasks.push(newTask);
      await fulfillJson(route, 201, { task: newTask });
      return;
    }

    // Unknown subpath — let the request through.
    await route.continue();
  });

  return {
    created,
    setNextPostFailure: (status, body = { error: "boom" }) => {
      nextPostFailure = { status, body };
    },
  };
}

test.describe("NewTaskModal launched from TaskList", () => {
  test("opens the dialog from the Add Task footer button", async ({ page }) => {
    await mockTasksApi(page);

    await page.goto("/test/tasks");

    const addBtn = page.getByRole("button", { name: /add task/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /add new task/i })
    ).toBeVisible();
  });

  test("smart default pre-selects the only enabled list", async ({ page }) => {
    await mockTasksApi(page);
    await page.goto("/test/tasks");

    await page.getByRole("button", { name: /add task/i }).click();
    const dialog = page.getByRole("dialog");

    const listSelect = dialog.getByLabel(/^list/i);
    await expect(listSelect).toHaveValue("list-groceries");
  });

  test("leaves the list unselected when multiple lists are enabled", async ({
    page,
  }) => {
    await mockTasksApi(page);
    await page.goto("/test/tasks?lists=multi");

    await page.getByRole("button", { name: /add task/i }).click();
    const dialog = page.getByRole("dialog");

    const listSelect = dialog.getByLabel(/^list/i);
    await expect(listSelect).toHaveValue("");
  });

  test("blocks submission and shows an inline error for missing title", async ({
    page,
  }) => {
    await mockTasksApi(page);
    await page.goto("/test/tasks");

    await page.getByRole("button", { name: /add task/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", { name: /add task/i }).click();

    await expect(dialog.getByText(/title is required/i)).toBeVisible();
    // Dialog remains open
    await expect(dialog).toBeVisible();
  });

  test("creates a task and the new task appears in the list", async ({
    page,
  }) => {
    const { created } = await mockTasksApi(page);
    await page.goto("/test/tasks");

    // Initial empty state
    await expect(page.getByText(/no tasks/i)).toBeVisible();

    await page.getByRole("button", { name: /add task/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Buy milk");
    await dialog.getByLabel(/notes/i).fill("Whole milk, 2L");

    await dialog.getByRole("button", { name: /add task/i }).click();

    // Dialog closes after success
    await expect(dialog).not.toBeVisible();

    // New task is rendered in the TaskList
    await expect(page.getByText("Buy milk")).toBeVisible();

    // POST captured by the mock
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      title: "Buy milk",
      notes: "Whole milk, 2L",
    });
  });

  test("keeps the dialog open and surfaces the error when the API rejects", async ({
    page,
  }) => {
    const api = await mockTasksApi(page);
    api.setNextPostFailure(500, { error: "Server boom" });

    await page.goto("/test/tasks");

    await page.getByRole("button", { name: /add task/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Will fail");
    await dialog.getByRole("button", { name: /add task/i }).click();

    await expect(dialog.getByText(/server boom/i)).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("Cancel closes the dialog without sending a request", async ({
    page,
  }) => {
    const { created } = await mockTasksApi(page);
    await page.goto("/test/tasks");

    await page.getByRole("button", { name: /add task/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Drafting");
    await dialog.getByRole("button", { name: /cancel/i }).click();

    await expect(dialog).not.toBeVisible();
    expect(created).toHaveLength(0);
  });
});
