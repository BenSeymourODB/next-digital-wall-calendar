# Deployment Guide

This document covers deployment configurations, scripts, and workflows for deploying this Next.js 16 application to Azure Web Apps.

## Deployment Scripts

### `scripts/lift-pnpm-standalone.js`

**Note for Next.js 16**: With the addition of `.npmrc` using `node-linker=hoisted`, this script is now a no-op on most systems. However, it's kept for backward compatibility and documentation purposes.

**Why it exists historically**: Azure Web Apps cannot resolve pnpm's symlink-based `node_modules` structure. This script was designed to physically copy all symlinked packages from `.pnpm/` store to root `node_modules/`, converting the virtual structure to a flat layout.

**What it does**:

1. Scans `.next/standalone/node_modules/.pnpm/` for all packages
2. Recursively copies symlinked dependencies as hard copies
3. Removes the `.pnpm/` directory after lifting

**When to run**: Automatically runs during `pnpm build:standalone` and in GitHub Actions before deployment. With hoisted node_modules, this script will find no `.pnpm` directory to process.

### `scripts/copy-static-to-standalone.js`

Copies `public/` assets and `.next/static/` files into `.next/standalone/` directory structure so the standalone server can serve them.

## Next.js Configuration

**Standalone Output Mode** (`next.config.ts`):

```typescript
output: "standalone"; // Creates minimal self-contained deployment package
compress: false; // Disable Next.js compression (Azure Front Door handles it)
```

**Standalone mode advantages**:

- Reduces package size from 500MB+ to 50-150MB (only runtime dependencies)
- Enables "build once, deploy anywhere" (avoids Azure Oryx's slow "build after deploy")
- Faster startup times (no transpilation needed on server)
- Includes optimized `server.js` (no need for `next start`)

## GitHub Actions Workflows

### Workflow 1: `.github/workflows/main_nextjs-template-build.yml`

Simple workflow that builds the app in standalone mode and runs the two scripts.

**Deployment Steps**:

1. Install pnpm and Node.js 22
2. Run `pnpm build` (Turbopack-based production build)
3. Copy static assets (`node scripts/copy-static-to-standalone.js`)
4. Lift pnpm modules (`node scripts/lift-pnpm-standalone.js`) - **CRITICAL STEP**

### Workflow 2: `.github/workflows/secretless-deploy-sample.yml`

Full deployment workflow with Azure authentication and CDN cache purging.

**Authentication**: Uses Azure User Managed Identity with Federated Credentials. The workflow authenticates via OIDC token exchange (no client secrets).

**Secrets Required**:

- `AZUREAPPSERVICE_CLIENTID_*` - Client ID of User Managed Identity
- `AZUREAPPSERVICE_TENANTID_*` - Azure Entra tenant ID
- `AZUREAPPSERVICE_SUBSCRIPTIONID_*` - Azure subscription ID

**Variables Required** (for CDN purging):

- `AZURE_FRONTDOOR_SUBSCRIPTION_ID` - Azure subscription ID for Front Door
- `AZURE_FRONTDOOR_RESOURCE_GROUP` - Resource group containing Front Door
- `AZURE_FRONTDOOR_PROFILE_NAME` - Front Door profile name
- `AZURE_FRONTDOOR_ENDPOINT_NAME` - Front Door endpoint name

**Deployment Steps**:

1. Install pnpm and Node.js 22
2. Cache pnpm store and Next.js build
3. Run `pnpm build` (Turbopack-based production build)
4. Copy static assets (`node scripts/copy-static-to-standalone.js`)
5. Lift pnpm modules (`node scripts/lift-pnpm-standalone.js`) - **CRITICAL STEP**
6. Create `startup.sh` script with `node server.js` command
7. Zip `.next/standalone/` into `deploy.zip`
8. Authenticate with Azure using OIDC
9. Deploy to Azure Web App
10. Purge Azure Front Door CDN cache (all content: `/*`)

**Cache Purging**: After deployment, the workflow automatically purges Azure Front Door cache to ensure users get the latest version. This may run in a different Azure subscription, configured via `AZURE_FRONTDOOR_*` variables.

## Environment Variables

### Local Development

Create a `.env.local` file (copy from `.env.local.template`):

```bash
# Application Insights (optional for local dev)
APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string-here
NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string-here
```

### Azure Web App

Configure environment variables in Azure Portal > Configuration > Application Settings:

- `NODE_ENV=production`
- `APPLICATIONINSIGHTS_CONNECTION_STRING=<your-connection-string>` - Server-side telemetry
- `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=<your-connection-string>` - Client-side telemetry
- Any API keys or secrets

## pnpm Configuration

The `.npmrc` file contains `node-linker=hoisted` which tells pnpm to use a flat node_modules structure instead of symlinks. This is required for:

1. **Windows compatibility**: Avoids EPERM symlink errors during standalone builds
2. **Azure deployment**: Ensures all dependencies are accessible without symlink resolution
3. **Simplified deployment**: The lifting script becomes unnecessary with hoisted modules

## Cache Headers

Next.js compression is disabled (`compress: false`) because Azure Front Door handles compression (must be configured in Azure Front Door). This avoids double compression and improves performance.

## Node Version

This project requires Node.js 22. Use `.nvmrc` for automatic version switching:

```bash
nvm use
```

## Testing Deployment Locally

To test the standalone build locally before deploying:

```bash
# Build standalone + copy static assets + resolve pnpm symlinks
pnpm build:standalone

# Run standalone server (simulates Azure environment)
pnpm start:standalone
```

This simulates the exact environment that will run in Azure.

## Troubleshooting Deployment

### Module Not Found Errors

If you see "Module not found" errors in Azure:

1. Verify `node-linker=hoisted` is in `.npmrc`
2. Ensure `scripts/lift-pnpm-standalone.js` ran during build
3. Check that all dependencies are in `dependencies` (not `devDependencies`)

### Build Failures

If the build fails during GitHub Actions:

1. Check the Node.js version matches (22.x)
2. Verify pnpm version in `package.json` engines field
3. Look for TypeScript errors in the build logs
4. Ensure all environment variables are set

### CDN Cache Not Purging

If updated content isn't appearing after deployment:

1. Verify `AZURE_FRONTDOOR_*` variables are set correctly
2. Check permissions on the User Managed Identity
3. Verify the subscription switch succeeded
4. Check Azure Front Door purge history in Azure Portal
