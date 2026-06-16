import { defineConfig, devices } from "@playwright/test";

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
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    // Mobile viewports for wall calendar display testing
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Pro 11"] },
    },
  ],

  // Local dev uses the Turbopack dev server for fast iteration. CI runs against
  // a production build (`next start`, built in a prior workflow step): the dev
  // server's on-demand compilation and memory growth starved late-running specs
  // under `workers: 1`, causing flaky 30s timeouts. A prebuilt server serves
  // every route instantly and stays stable for the whole run.
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
