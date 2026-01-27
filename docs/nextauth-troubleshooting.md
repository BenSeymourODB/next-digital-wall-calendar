# NextAuth.js Troubleshooting Guide

This guide documents common NextAuth.js configuration errors and their solutions.

## Error: "Configuration" (Most Common)

**Symptom:** After completing the Google OAuth login flow, you're redirected to `/auth/error?error=Configuration` with the message "Server Configuration Error - There is a problem with the server configuration."

### Cause 1: Missing or Incorrect OAuth Redirect URI (Most Likely)

The Google Cloud Console OAuth client must have the correct redirect URI configured.

**Solution:**

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. For production, also add:
   ```
   https://your-domain.com/api/auth/callback/google
   ```
5. Click **Save**
6. Wait 1-2 minutes for changes to propagate
7. Try signing in again

**Important:** The redirect URI must include `/api/auth/callback/google` - this is the NextAuth.js callback endpoint. Just using `http://localhost:3000` will NOT work.

### Cause 2: Missing AUTH_SECRET Environment Variable

NextAuth v5 requires `AUTH_SECRET` to be set.

**Solution:**

1. Generate a secret:

   ```bash
   openssl rand -base64 32
   ```

2. Add to `.env.local`:

   ```
   AUTH_SECRET=your-generated-secret-here
   ```

3. Restart the dev server

### Cause 3: Database Connection Failed

If the Prisma adapter can't connect to PostgreSQL, authentication will fail.

**Solution:**

1. Verify PostgreSQL is running:

   ```bash
   # If using Docker
   docker ps | grep postgres

   # Or check service status
   sudo systemctl status postgresql
   ```

2. Test database connection:

   ```bash
   pnpm prisma db push
   ```

3. Verify `DATABASE_URL` in `.env.local` is correct:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/calendar_db"
   ```

### Cause 4: Missing or Invalid OAuth Credentials

**Solution:**

Verify these environment variables are set correctly in `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
```

Both must match the values from your Google Cloud Console OAuth 2.0 Client.

## Error: "OAuthCallback"

**Symptom:** Error during the OAuth callback phase.

**Common Causes:**

1. **Redirect URI mismatch** - See "Configuration" error solutions above
2. **Invalid state parameter** - Clear browser cookies and try again
3. **OAuth client misconfigured** - Verify OAuth client type is "Web application"

## Error: "AccessDenied"

**Symptom:** "You do not have permission to sign in."

**Causes:**

1. **User denied permissions** - User clicked "Deny" on Google consent screen
2. **Test user not added** - If app is in testing mode, the user must be added as a test user

**Solution for test users:**

1. Go to [Google Cloud Console > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Under **Test users**, click **Add Users**
3. Add the email address that's trying to sign in
4. Try signing in again

## Error: "OAuthAccountNotLinked"

**Symptom:** "This email is already associated with another sign-in method."

**Cause:** User previously signed in with a different method (e.g., email/password) and the email is already registered.

**Solution:**

- Sign in using the original method
- Or, if you want to link the Google account, implement account linking in the NextAuth configuration

## Debugging Tips

### Enable Debug Logging

Add to your auth configuration:

```typescript
// src/lib/auth/auth.ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true, // or: process.env.NODE_ENV === "development"
  // ... rest of config
});
```

This will log detailed information to the server console including:

- PKCE code verifier creation and validation
- OAuth authorization URL generation
- Token exchange details
- Account creation/update operations
- Session creation

### Reading Debug Logs

When debug is enabled, look for these log patterns:

```
[auth][debug]: CREATE_PKCECODEVERIFIER {...}     # Sign-in initiation
[auth][debug]: authorization url is ready {...}  # Redirect to Google
[auth][debug]: USE_PKCECODEVERIFIER {...}        # Callback processing
[auth][error] ...                                # Actual error details
```

The `[auth][error]` lines will show the actual error causing the Configuration error.

### Check Server Logs

When encountering errors, check the terminal running `pnpm dev` for detailed error messages. NextAuth logs the actual error cause to the server console while showing a generic message to users.

### Verify Environment Variables

```bash
# Check if env vars are loaded (run in project directory)
node -e "console.log({
  AUTH_SECRET: process.env.AUTH_SECRET ? 'SET' : 'MISSING',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
  DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
})"
```

### Test Database Connection

```bash
pnpm prisma db push
```

If this fails, fix the database connection before trying OAuth.

### Clear Existing Data (Fresh Start)

If you suspect issues with existing account data, you can clear and retry:

```bash
# Connect to PostgreSQL
psql "postgresql://postgres:postgres@localhost:5432/calendar_db"

# View existing data
SELECT u.email, a.provider, s.expires FROM "User" u
LEFT JOIN "Account" a ON u.id = a."userId"
LEFT JOIN "Session" s ON u.id = s."userId";

# Clear all auth data (WARNING: removes all users)
DELETE FROM "Session";
DELETE FROM "Account";
DELETE FROM "User";

# Exit
\q
```

After clearing, restart the dev server and try signing in again.

## Quick Checklist

When encountering the "Configuration" error, verify:

- [ ] Google Cloud Console has redirect URI: `http://localhost:3000/api/auth/callback/google`
- [ ] `AUTH_SECRET` is set in `.env.local`
- [ ] `GOOGLE_CLIENT_ID` is set in `.env.local`
- [ ] `GOOGLE_CLIENT_SECRET` is set in `.env.local`
- [ ] `DATABASE_URL` is set and PostgreSQL is running
- [ ] Database schema is up to date (`pnpm prisma db push`)
- [ ] If app is in testing mode, your email is added as a test user
- [ ] Dev server was restarted after changing `.env.local`

## Environment Variables Reference

| Variable               | Required | Description                                                           |
| ---------------------- | -------- | --------------------------------------------------------------------- |
| `AUTH_SECRET`          | Yes      | Secret for encrypting tokens. Generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`     | Yes      | OAuth 2.0 Client ID from Google Cloud Console                         |
| `GOOGLE_CLIENT_SECRET` | Yes      | OAuth 2.0 Client Secret from Google Cloud Console                     |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                                          |
| `NEXTAUTH_URL`         | No\*     | Base URL of your app. Required in production, optional in development |

\*NextAuth v5 auto-detects the URL in development.
