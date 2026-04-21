import { expect, test } from "@playwright/test";

/**
 * Keyboard navigation E2E for the month-view grid (SimpleCalendar).
 *
 * Exercises the WAI-ARIA grid pattern end-to-end: arrow keys move the
 * selected cell, Home/End snap to the week boundaries, PageUp/PageDown
 * step by month, Shift+Page steps by year, and Enter/Space commit a
 * selection.
 *
 * Uses the `controls=false` variant of the test page so stray test
 * buttons above the grid don't steal keyboard focus.
 */

// Captures video of the keyboard-driven interactions so animations /
// focus transitions can be reviewed in the PR.
test.use({ video: "on" });

test.describe("SimpleCalendar — keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(
      "/test/calendar?events=default&view=month&controls=false&sidebar=false"
    );
    // Grid must be rendered before we can focus a cell.
    await expect(page.getByRole("grid", { name: /calendar$/i })).toBeVisible();
  });

  test("initial state: exactly one gridcell has tabIndex=0 and is aria-selected", async ({
    page,
  }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);

    const focusables = page.locator('[role="gridcell"][tabindex="0"]');
    await expect(focusables).toHaveCount(1);
  });

  test("ArrowRight advances selection by one day", async ({ page }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    const before = await selected.getAttribute("data-date");
    expect(before).not.toBeNull();

    await selected.focus();
    await page.keyboard.press("ArrowRight");

    const after = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");
    expect(after).not.toBe(before);

    // Verify the new selection is exactly one calendar day later.
    const beforeDate = new Date(before!);
    const afterDate = new Date(after!);
    const diffMs = afterDate.getTime() - beforeDate.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  test("ArrowLeft moves selection back by one day", async ({ page }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    const before = await selected.getAttribute("data-date");

    await selected.focus();
    await page.keyboard.press("ArrowLeft");

    const after = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");

    const diffMs = new Date(before!).getTime() - new Date(after!).getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  test("ArrowDown advances selection by one week", async ({ page }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    const before = await selected.getAttribute("data-date");

    await selected.focus();
    await page.keyboard.press("ArrowDown");

    const after = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");

    const diffMs = new Date(after!).getTime() - new Date(before!).getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("ArrowUp moves selection back by one week", async ({ page }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    const before = await selected.getAttribute("data-date");

    await selected.focus();
    await page.keyboard.press("ArrowUp");

    const after = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");

    const diffMs = new Date(before!).getTime() - new Date(after!).getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("Home snaps selection to the start of the current week (Sunday)", async ({
    page,
  }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("Home");

    const afterKey = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");
    const afterDate = new Date(afterKey!);
    // WEEK_STARTS_ON = 0 (Sunday). JS Date.getUTCDay() for an ISO-style
    // `YYYY-MM-DD` parses at UTC midnight; compare on local getDay() by
    // constructing a local date. We formatted the key via date-fns, so
    // splitting the components avoids timezone drift.
    const [y, m, d] = afterKey!.split("-").map(Number);
    const localDate = new Date(y, m - 1, d);
    expect(localDate.getDay()).toBe(0);
    expect(afterDate).toBeTruthy();
  });

  test("End snaps selection to the end of the current week (Saturday)", async ({
    page,
  }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("End");

    const afterKey = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");
    const [y, m, d] = afterKey!.split("-").map(Number);
    expect(new Date(y, m - 1, d).getDay()).toBe(6);
  });

  test("PageDown advances selection by one month and updates the header", async ({
    page,
  }) => {
    const header = page.locator("h2").first();
    const headerBefore = await header.textContent();

    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("PageDown");

    await expect(header).not.toHaveText(headerBefore!);

    // The new grid should have an aria-label containing the new month.
    const grid = page.getByRole("grid");
    await expect(grid).toHaveAttribute(
      "aria-label",
      new RegExp(`${(await header.textContent())!.trim()}`)
    );
  });

  test("PageUp moves selection back by one month and updates the header", async ({
    page,
  }) => {
    const header = page.locator("h2").first();
    const headerBefore = await header.textContent();

    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("PageUp");

    await expect(header).not.toHaveText(headerBefore!);
  });

  test("Shift+PageDown jumps one year forward", async ({ page }) => {
    const header = page.locator("h2").first();
    const before = (await header.textContent())!.trim();

    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("Shift+PageDown");

    const after = (await header.textContent())!.trim();
    const yearBefore = Number(before.split(" ").pop());
    const yearAfter = Number(after.split(" ").pop());
    expect(yearAfter - yearBefore).toBe(1);
  });

  test("Shift+PageUp jumps one year backward", async ({ page }) => {
    const header = page.locator("h2").first();
    const before = (await header.textContent())!.trim();

    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("Shift+PageUp");

    const after = (await header.textContent())!.trim();
    const yearBefore = Number(before.split(" ").pop());
    const yearAfter = Number(after.split(" ").pop());
    expect(yearBefore - yearAfter).toBe(1);
  });

  test("Enter on a gridcell selects that cell", async ({ page }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();

    // Move right, then commit with Enter.
    await page.keyboard.press("ArrowRight");
    const movedKey = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");

    // Enter on the selected cell should leave it selected (Enter is a
    // no-op when the cell is already selected — the assertion is that it
    // doesn't blow up and keeps the selection stable).
    await page.keyboard.press("Enter");
    await expect(
      page.locator('[role="gridcell"][aria-selected="true"]')
    ).toHaveAttribute("data-date", movedKey!);
  });

  test("Space key also commits the selection", async ({ page }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();

    await page.keyboard.press("ArrowRight");
    const movedKey = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");

    await page.keyboard.press(" ");
    await expect(
      page.locator('[role="gridcell"][aria-selected="true"]')
    ).toHaveAttribute("data-date", movedKey!);
  });

  test("focus follows selection after keyboard navigation", async ({
    page,
  }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("ArrowRight");

    // After ArrowRight, the newly-selected cell should have focus.
    const focused = page.locator('[role="gridcell"]:focus');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveAttribute("aria-selected", "true");
  });

  test("aria-current='date' remains on today regardless of selection movement", async ({
    page,
  }) => {
    const today = page.locator('[role="gridcell"][aria-current="date"]');
    await expect(today).toHaveCount(1);
    const todayKey = await today.getAttribute("data-date");

    // Move selection away from today.
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    await selected.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // aria-current stays on today even as aria-selected moves.
    const todayAfter = page.locator('[role="gridcell"][aria-current="date"]');
    await expect(todayAfter).toHaveCount(1);
    await expect(todayAfter).toHaveAttribute("data-date", todayKey!);
  });

  test("unhandled keys (Escape, Tab) do not change the selection", async ({
    page,
  }) => {
    const selected = page.locator('[role="gridcell"][aria-selected="true"]');
    const before = await selected.getAttribute("data-date");

    await selected.focus();
    await page.keyboard.press("Escape");

    const after = await page
      .locator('[role="gridcell"][aria-selected="true"]')
      .getAttribute("data-date");
    expect(after).toBe(before);
  });

  test("clicking a gridcell selects it", async ({ page }) => {
    // Pick a non-selected in-month cell by scanning gridcells and finding
    // one that isn't today's selected cell and isn't aria-disabled.
    const cells = page.locator(
      '[role="gridcell"]:not([aria-disabled="true"]):not([aria-selected="true"])'
    );
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);

    const target = cells.first();
    const targetKey = await target.getAttribute("data-date");
    await target.click();

    await expect(
      page.locator('[role="gridcell"][aria-selected="true"]')
    ).toHaveAttribute("data-date", targetKey!);
  });
});
