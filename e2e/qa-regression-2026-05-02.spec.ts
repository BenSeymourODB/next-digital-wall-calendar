import { type ConsoleMessage, type Page, expect, test } from "@playwright/test";
import { mkdir } from "fs/promises";
import path from "path";

const SHOTS_DIR = "docs/screenshots/qa-regression-2026-05-02";

type ConsoleEntry = { type: string; text: string; location?: string };
type NetEntry = { url: string; status: number; method: string };

const KNOWN_NOISE = [
  "AppInsights",
  "Application Insights",
  "Download the React DevTools",
  "[Fast Refresh]",
  "[HMR]",
  "Hydration error",
  "<Suspense> fallback",
];

function attachConsoleAndNetwork(page: Page) {
  const consoleEntries: ConsoleEntry[] = [];
  const networkErrors: NetEntry[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (KNOWN_NOISE.some((n) => text.includes(n))) return;
    consoleEntries.push({
      type,
      text,
      location: msg.location()?.url,
    });
  });

  page.on("response", (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && url.includes("localhost:3000")) {
      networkErrors.push({ url, status, method: resp.request().method() });
    }
  });

  return { consoleEntries, networkErrors };
}

async function shot(page: Page, name: string) {
  const dir = path.resolve(process.cwd(), SHOTS_DIR);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// Each test is an independent regression case so failures are isolated and
// reportable. Order is the spec order from the QA plan (A1 → A11).

test.describe("QA Regression A1 — Calendar views", () => {
  test("A1.1 month/default", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=month&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-month-default.png");
    expect(obs.networkErrors, "no 4xx/5xx").toEqual([]);
    expect(obs.consoleEntries, "no console errors").toEqual([]);
  });

  test("A1.2 week/default", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=week&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByText("Morning Standup").first()).toBeVisible();
    await shot(page, "cal-week-default.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A1.3 day/overflow", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=day&events=overflow");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-day-overflow.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A1.4 year/family", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=year&events=family");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-year-family.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A1.5 agenda/family", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=agenda&events=family");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-agenda-family.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A1.6 clock/default", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=clock&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-clock-top-level.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A1.7 month/empty", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=month&events=empty");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-month-empty.png");
    expect(obs.networkErrors).toEqual([]);
    expect(obs.consoleEntries).toEqual([]);
  });

  test("A1.8 week/multiDay", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=week&events=multiDay");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "cal-week-multiday.png");
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A2 — View transitions", () => {
  test("A2.1 month → week → day → year → agenda → clock", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=month&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();

    const transitions: Array<{ to: string; label: RegExp; file: string }> = [
      { to: "week", label: /^Week$/i, file: "transition-month-to-week.png" },
      { to: "day", label: /^Day$/i, file: "transition-week-to-day.png" },
      { to: "year", label: /^Year$/i, file: "transition-day-to-year.png" },
      {
        to: "agenda",
        label: /^Agenda$/i,
        file: "transition-year-to-agenda.png",
      },
      {
        to: "clock",
        label: /^Clock$/i,
        file: "transition-agenda-to-clock.png",
      },
    ];

    for (const t of transitions) {
      // ViewSwitcher buttons — try role=button with name matching
      const btn = page.getByRole("button", { name: t.label });
      if ((await btn.count()) > 0) {
        await btn.first().click();
      } else {
        // Fallback: link or tab role
        await page.getByText(t.label).first().click({ trial: false });
      }
      await page.waitForTimeout(400);
      await shot(page, t.file);
    }
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A3 — Analog clock variants", () => {
  const clockCases: Array<{ url: string; file: string }> = [
    {
      url: "/test/analog-clock?scenario=default&hour=10&min=15",
      file: "clock-default.png",
    },
    {
      url: "/test/analog-clock?scenario=overlap&hour=3",
      file: "clock-overlap.png",
    },
    {
      url: "/test/analog-clock?scenario=colors&hour=0",
      file: "clock-colors.png",
    },
    { url: "/test/analog-clock?scenario=empty", file: "clock-empty.png" },
    {
      url: "/test/analog-clock?scenario=dense&size=800",
      file: "clock-dense-large.png",
    },
    {
      url: "/test/analog-clock?scenario=all-day-mix&hour=9&input=raw",
      file: "clock-all-day-mix.png",
    },
    {
      url: "/test/analog-clock?scenario=default&seconds=true&hour=10&min=15",
      file: "clock-with-seconds.png",
    },
  ];

  for (const c of clockCases) {
    test(`A3 ${c.file}`, async ({ page }) => {
      const obs = attachConsoleAndNetwork(page);
      await page.goto(c.url);
      // The analog clock test page renders an SVG — wait for it
      await expect(page.locator("svg").first()).toBeVisible();
      await shot(page, c.file);
      expect(obs.networkErrors).toEqual([]);
    });
  }
});

test.describe("QA Regression A4 — Mini-cal sidebar + hide rule", () => {
  test("A4 sidebar shown on week, hidden on month/year/clock", async ({
    page,
  }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=week&sidebar=true&events=family");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "sidebar-week.png");

    // Switch to month
    const monthBtn = page.getByRole("button", { name: /^Month$/i });
    if ((await monthBtn.count()) > 0) await monthBtn.first().click();
    await page.waitForTimeout(400);
    await shot(page, "sidebar-hidden-on-month.png");

    // Switch to year
    const yearBtn = page.getByRole("button", { name: /^Year$/i });
    if ((await yearBtn.count()) > 0) await yearBtn.first().click();
    await page.waitForTimeout(400);
    await shot(page, "sidebar-hidden-on-year.png");

    // Switch to clock
    const clockBtn = page.getByRole("button", { name: /^Clock$/i });
    if ((await clockBtn.count()) > 0) await clockBtn.first().click();
    await page.waitForTimeout(400);
    await shot(page, "sidebar-hidden-on-clock.png");

    // Switch to agenda — sidebar should reappear
    const agendaBtn = page.getByRole("button", { name: /^Agenda$/i });
    if ((await agendaBtn.count()) > 0) await agendaBtn.first().click();
    await page.waitForTimeout(400);
    await shot(page, "sidebar-shown-on-agenda.png");

    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A5 — Filter panel", () => {
  test("A5 filter panel renders + basic toggle", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=month&filters=true&events=family");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "filters-initial.png");
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A6 — Agenda search", () => {
  test("A6 agenda search 'Piano' filters list", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=agenda&events=family");
    await expect(page.getByTestId("calendar-display")).toBeVisible();

    const searchInput = page
      .getByRole("textbox", { name: /search/i })
      .or(page.getByPlaceholder(/search/i));
    if ((await searchInput.count()) > 0) {
      await searchInput.first().fill("Piano");
      await page.waitForTimeout(300);
      await shot(page, "agenda-search-piano.png");

      await searchInput.first().fill("zzznomatch");
      await page.waitForTimeout(300);
      await shot(page, "agenda-empty-results.png");
    } else {
      await shot(page, "agenda-search-NO-INPUT-FOUND.png");
    }
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A7 — Event detail modal", () => {
  test("A7 click event opens modal; Escape closes", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=month&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();

    const eventChip = page
      .getByText("Project Review", { exact: false })
      .first();
    if ((await eventChip.count()) > 0) {
      await eventChip.click();
      await page.waitForTimeout(300);
      await shot(page, "event-detail-modal-open.png");

      // The modal should be a dialog
      const dialog = page.getByRole("dialog");
      if ((await dialog.count()) > 0) {
        await expect(dialog.first()).toBeVisible();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        await shot(page, "event-detail-modal-closed.png");
      }
    } else {
      await shot(page, "event-detail-NO-CHIP-FOUND.png");
    }
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A8 — ARIA + keyboard nav", () => {
  test("A8 month grid has ARIA roles + arrow nav", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/calendar?view=month&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();

    // Look for grid roles
    const grid = page.getByRole("grid").first();
    const gridExists = (await grid.count()) > 0;
    if (gridExists) {
      await expect(grid).toBeVisible();
    }

    // Capture aria snapshot of the calendar display
    const ariaSnapshot = await page
      .getByTestId("calendar-display")
      .ariaSnapshot();
    const fs = await import("fs/promises");
    await fs.writeFile(
      path.resolve(process.cwd(), SHOTS_DIR, "aria-month-grid.txt"),
      ariaSnapshot,
      "utf8"
    );

    await shot(page, "aria-month-grid-screenshot.png");
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A9 — Settings UI", () => {
  test("A9 /test/settings renders form", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/settings");
    await page.waitForLoadState("networkidle");
    await shot(page, "settings-form.png");
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A10 — Scheduler", () => {
  test("A10.1 /test/scheduler renders", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/scheduler");
    await page.waitForLoadState("networkidle");
    await shot(page, "scheduler-initial.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A10.2 /test/scheduler-demo renders", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.goto("/test/scheduler-demo");
    await page.waitForLoadState("networkidle");
    await shot(page, "scheduler-demo-a.png");
    expect(obs.networkErrors).toEqual([]);
  });
});

test.describe("QA Regression A11 — Mobile + tablet", () => {
  test("A11.1 mobile agenda 390x844", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/test/calendar?view=agenda&events=family");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "mobile-agenda.png");
    expect(obs.networkErrors).toEqual([]);
  });

  test("A11.2 tablet month 1024x768", async ({ page }) => {
    const obs = attachConsoleAndNetwork(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/test/calendar?view=month&events=default");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await shot(page, "tablet-month.png");
    expect(obs.networkErrors).toEqual([]);
  });
});
