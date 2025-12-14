#!/usr/bin/env node

/**
 * This script lifts all modules from the .pnpm leaf node_modules directories
 * to the root node_modules directory in the standalone output.
 * It preserves the folder structure and handles symlinks by copying them as hard copies.
 */

const path = require("path");
const fs = require("fs-extra");

// Path to the standalone output directory
const standaloneDir = path.join(__dirname, "..", ".next", "standalone");
const nodeModulesDir = path.join(standaloneDir, "node_modules");
const pnpmDir = path.join(nodeModulesDir, ".pnpm");

/**
 * Recursively converts all symlinks in a directory to hard copies
 * @param {string} dirPath - The directory path to process
 */
async function convertSymlinksToHardCopies(dirPath, isRoot = false) {
  // Get all items in the directory
  const items = await fs.readdir(dirPath);

  for (const item of items) {
    // Skip .pnpm directory in root node_modules it is taken care of at liftModulesFromPnpm
    if (isRoot && item === ".pnpm") continue;

    const itemPath = path.join(dirPath, item);
    const stats = await fs.lstat(itemPath);

    if (stats.isSymbolicLink()) {
      // Get the target of the symlink
      const targetPath = await fs.readlink(itemPath);
      const resolvedTargetPath = path.resolve(dirPath, targetPath);

      if (!fs.existsSync(targetPath)) {
        console.error(`Target does not exist: ${targetPath}`);
        fs.removeSync(itemPath);
      }

      // Copy the target to the original symlink location
      if ((await fs.stat(resolvedTargetPath)).isDirectory()) {
        await fs.copy(resolvedTargetPath, itemPath, {
          dereference: true,
          overwrite: true,
          errorOnExist: false,
        });
      } else {
        await fs.copyFile(resolvedTargetPath, itemPath, {
          dereference: true,
          overwrite: true,
          errorOnExist: false,
        });
      }
    } else if (stats.isDirectory()) {
      // Recursively process subdirectories
      await convertSymlinksToHardCopies(itemPath, true);
    }
  }
}

/**
 * Processes .pnpm directories and lifts up their node_modules to the root node_modules
 */
const liftModulesFromPnpm = () => {
  // Check if .pnpm directory exists
  if (!fs.existsSync(pnpmDir)) {
    console.error(`.pnpm directory not found at ${pnpmDir}`);
    return;
  }

  // Get all directories in the .pnpm directory
  const pnpmDirs = fs
    .readdirSync(pnpmDir)
    .filter((dir) => fs.statSync(path.join(pnpmDir, dir)).isDirectory());

  console.log(`Found ${pnpmDirs.length} package directories in .pnpm`);

  // Process each .pnpm package directory
  for (const pnpmPkgDir of pnpmDirs) {
    const pnpmPkgPath = path.join(pnpmDir, pnpmPkgDir);
    let nodeModulesInPnpm = pnpmPkgPath;

    // Stupid edgecase has .pnpm/X/node_modules/<node_modules> but also .pnpm/node_modules/<node_modules>
    if (!nodeModulesInPnpm.endsWith("node_modules")) {
      nodeModulesInPnpm = path.join(pnpmPkgPath, "node_modules");
    }

    // Get all modules in this package's node_modules
    const moduleDirs = fs.readdirSync(nodeModulesInPnpm);

    // Copy each module to the root node_modules
    for (const moduleDirOrFile of moduleDirs) {
      const sourcePath = path.join(nodeModulesInPnpm, moduleDirOrFile);
      const destPath = path.join(nodeModulesDir, moduleDirOrFile);

      // Check if destination already exists
      if (fs.existsSync(destPath)) {
        if (!fs.statSync(destPath).isDirectory()) {
          continue;
        }

        if (!fs.statSync(sourcePath).isDirectory()) {
          throw new Error(
            `very wierd - dest is a directory but source is not [source: ${sourcePath}, dest: ${destPath}]`
          );
        }

        for (const subModuleDirOrFile of fs.readdirSync(sourcePath)) {
          const subSourcePath = path.join(sourcePath, subModuleDirOrFile);
          const subDestPath = path.join(destPath, subModuleDirOrFile);

          if (fs.existsSync(subDestPath)) {
            continue;
          }

          // Copy sub directory with all contents, resolving symlinks to real files
          fs.copySync(subSourcePath, subDestPath, {
            overwrite: false,
            dereference: true, // Convert symlinks to actual files/directories
            errorOnExist: false, // Don't error if destination exists
          });
        }
        continue;
      }

      // Copy directory with all contents, resolving symlinks to real files
      fs.copySync(sourcePath, destPath, {
        overwrite: false,
        dereference: true, // Convert symlinks to actual files/directories
        errorOnExist: false, // Don't error if destination exists
      });
    }
  }
};

// Main function
const main = async () => {
  // console.log('Starting to lift modules from .pnpm to root node_modules...');

  if (!fs.existsSync(standaloneDir)) {
    // console.error(`Standalone directory not found: ${standaloneDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(nodeModulesDir)) {
    // console.error(`node_modules directory not found: ${nodeModulesDir}`);
    process.exit(1);
  }

  console.log("Converting symlinks to hard copies recursively...");
  await convertSymlinksToHardCopies(nodeModulesDir);
  console.log("Finished converting symlinks to hard copies.");

  console.log("Lifting modules from .pnpm to root node_modules...");
  liftModulesFromPnpm();
  console.log("Finished lifting modules from .pnpm to root node_modules.");

  console.log("Removing .pnpm directory...");
  fs.removeSync(pnpmDir);
  console.log("Finished removing .pnpm directory.");
};

// Run the script
main();
