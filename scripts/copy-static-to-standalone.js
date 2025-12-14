#!/usr/bin/env node

/**
 * This script copies static assets and public files to the standalone output directory.
 * Next.js standalone builds don't include these by default.
 */

const path = require("path");
const fs = require("fs-extra");

// Paths relative to project root
const projectRoot = path.join(__dirname, "..");
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const staticSource = path.join(projectRoot, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(projectRoot, "public");
const publicDest = path.join(standaloneDir, "public");

const main = async () => {
  console.log("Copying static assets to standalone directory...");

  // Check if standalone directory exists
  if (!fs.existsSync(standaloneDir)) {
    console.error(`Standalone directory not found: ${standaloneDir}`);
    console.error('Make sure you run "pnpm build" first.');
    process.exit(1);
  }

  // Copy .next/static directory
  if (fs.existsSync(staticSource)) {
    console.log(`Copying ${staticSource} to ${staticDest}`);
    await fs.copy(staticSource, staticDest, {
      overwrite: true,
      errorOnExist: false,
    });
    console.log("✓ Static assets copied successfully");
  } else {
    console.warn(`Warning: Static directory not found at ${staticSource}`);
  }

  // Copy public directory
  if (fs.existsSync(publicSource)) {
    console.log(`Copying ${publicSource} to ${publicDest}`);
    await fs.copy(publicSource, publicDest, {
      overwrite: true,
      errorOnExist: false,
    });
    console.log("✓ Public directory copied successfully");
  } else {
    console.log("No public directory found, skipping...");
  }

  console.log("Finished copying static assets!");
};

main().catch((error) => {
  console.error("Error copying static assets:", error);
  process.exit(1);
});
