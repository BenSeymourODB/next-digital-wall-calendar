/**
 * Playwright "setup" project that runs once before authenticated specs.
 *
 * Creates a shared test user via `getOrCreateSharedTestUser()`, attaches
 * the NextAuth session cookie to a fresh browser context, and persists
 * `storageState` to `playwright/.auth/user.json`. The
 * `authenticated-chromium` project (see `playwright.config.ts`) reads
 * that file via `use.storageState` so every spec under
 * `e2e/authenticated/**` starts already-signed-in. Issue #278.
 */
import { expect, test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  SHARED_STORAGE_STATE_PATH,
  disconnectDatabase,
  getOrCreateSharedTestUser,
  setAuthCookies,
} from "./auth/auth-setup";

setup("authenticate shared E2E user", async ({ browser, baseURL }) => {
  const user = await getOrCreateSharedTestUser();

  const context = await browser.newContext();
  await setAuthCookies(context, user.sessionToken);

  // Visiting the origin materialises the cookie under `localhost` so it
  // survives the `storageState` snapshot. NextAuth resolves the session
  // server-side from the cookie, so any same-origin page works — pick a
  // public route to avoid coupling this setup to the auth-gated routes
  // we're trying to enable.
  const page = await context.newPage();
  const target = `${baseURL ?? "http://localhost:3000"}/auth/signin`;
  await page.goto(target);

  fs.mkdirSync(path.dirname(SHARED_STORAGE_STATE_PATH), { recursive: true });
  await context.storageState({ path: SHARED_STORAGE_STATE_PATH });
  expect(fs.existsSync(SHARED_STORAGE_STATE_PATH)).toBe(true);

  await context.close();
});

setup.afterAll(async () => {
  await disconnectDatabase();
});
