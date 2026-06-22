/**
 * Playwright "teardown" project that runs after every spec depending on
 * the `setup` project has finished. Deletes the shared E2E user and the
 * persisted `storageState` so re-runs start clean. Issue #278.
 */
import { test as teardown } from "@playwright/test";
import fs from "fs";
import {
  SHARED_STORAGE_STATE_PATH,
  cleanupSharedTestUser,
  disconnectDatabase,
} from "./auth/auth-setup";

teardown("clean up shared E2E user", async () => {
  await cleanupSharedTestUser();
  if (fs.existsSync(SHARED_STORAGE_STATE_PATH)) {
    fs.rmSync(SHARED_STORAGE_STATE_PATH);
  }
});

teardown.afterAll(async () => {
  await disconnectDatabase();
});
