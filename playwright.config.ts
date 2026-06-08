import { defineConfig, devices } from "@playwright/test";
import { SHARED_STORAGE_STATE_PATH } from "./e2e/auth/auth-setup";

// Specs under this directory require the shared auth fixture
// (`e2e/auth.setup.ts` → `playwright/.auth/user.json`) and only run in
// the `authenticated-chromium` project below. Issue #278.
const AUTHENTICATED_SCOPE = /e2e[\\/]authenticated[\\/].*\.spec\.ts$/;

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Use test database if available
    extraHTTPHeaders: {
      "x-test-mode": "true",
    },
  },
  // Load environment variables for tests
  // TEST_DATABASE_URL should be set in .env.test or CI environment
  // to use a separate test database

  projects: [
    // Auth-fixture lifecycle. `setup` provisions the shared E2E user
    // and dumps storageState; `teardown` runs after every project that
    // depends on `setup` finishes and removes the user.
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      teardown: "teardown",
    },
    {
      name: "teardown",
      testMatch: /.*\.teardown\.ts/,
    },
    // Authenticated browser project — only picks up specs in
    // `e2e/authenticated/**` and loads the storageState saved by the
    // setup project. Other browsers can be added when a consumer needs
    // them; chromium-only keeps the cost of running the full E2E
    // matrix bounded.
    {
      name: "authenticated-chromium",
      testMatch: AUTHENTICATED_SCOPE,
      use: {
        ...devices["Desktop Chrome"],
        storageState: SHARED_STORAGE_STATE_PATH,
      },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      testIgnore: AUTHENTICATED_SCOPE,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: AUTHENTICATED_SCOPE,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: AUTHENTICATED_SCOPE,
      use: { ...devices["Desktop Safari"] },
    },
    // Mobile viewports for wall calendar display testing
    {
      name: "mobile-chrome",
      testIgnore: AUTHENTICATED_SCOPE,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "tablet",
      testIgnore: AUTHENTICATED_SCOPE,
      use: { ...devices["iPad Pro 11"] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
