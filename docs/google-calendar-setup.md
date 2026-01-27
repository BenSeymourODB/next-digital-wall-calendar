# Google Calendar API Setup Guide

This guide will walk you through setting up Google Calendar API credentials for your digital wall calendar application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "Wall Calendar")
5. Click **"Create"**

## Step 2: Enable Google Calendar API

1. In your project, navigate to **"APIs & Services" > "Library"**
2. Search for **"Google Calendar API"**
3. Click on **"Google Calendar API"**
4. Click **"Enable"**

## Step 3: Create OAuth 2.0 Credentials

### Configure OAuth Consent Screen

1. Navigate to **"APIs & Services" > "OAuth consent screen"**
2. Select **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**
4. Fill in the required information:
   - **App name**: "Wall Calendar" (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **"Save and Continue"**
6. On the **Scopes** page:
   - Click **"Add or Remove Scopes"**
   - Search for and add the following scopes:
     - `https://www.googleapis.com/auth/calendar.readonly` (Google Calendar API - Read-only access)
     - `https://www.googleapis.com/auth/userinfo.email` (View your email address)
     - `https://www.googleapis.com/auth/userinfo.profile` (See your personal info, including any personal info you've made publicly available)
   - Click **"Update"**
   - Click **"Save and Continue"**
7. On the **Test users** page:
   - Click **"Add Users"**
   - Add the email addresses of users who will access the calendar (including yourself)
   - Click **"Save and Continue"**
8. Review your settings and click **"Back to Dashboard"**

### Create OAuth 2.0 Client ID

1. Navigate to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials"** and select **"OAuth client ID"**
3. Select **"Web application"** as the application type
4. Give it a name (e.g., "Wall Calendar Web Client")
5. Add **Authorized JavaScript origins**:
   - For local development: `http://localhost:3000`
   - For production: `https://your-domain.com`
6. Add **Authorized redirect URIs**:
   - For NextAuth.js (server-side auth): `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-domain.com/api/auth/callback/google`

   **Important:** The redirect URI MUST include `/api/auth/callback/google` for NextAuth.js to work. Without this path, you'll get a "Configuration" error.

7. Click **"Create"**
8. A dialog will appear with your **Client ID** and **Client Secret**
   - **Copy both the Client ID and Client Secret** - you'll need these for your `.env.local` file
   - ⚠️ **Important**: Keep the Client Secret secure! Never commit it to version control.

## Step 4: Create API Key

1. Navigate to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials"** and select **"API key"**
3. **Copy the API Key** - you'll need this for your `.env.local` file
4. (Optional but recommended) Click **"Restrict Key"** to add restrictions:
   - Under **"API restrictions"**, select **"Restrict key"**
   - Choose **"Google Calendar API"** from the dropdown
   - Click **"Save"**

## Step 5: Configure Your Application

1. In your project root, copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and add your credentials:

   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

   ⚠️ **Important**: The `GOOGLE_CLIENT_SECRET` is used server-side to refresh access tokens automatically. Keep it secure and never expose it in client-side code.

3. Replace the placeholders with the values you copied in previous steps

## Step 6: Test the Integration

1. Start your development server:

   ```bash
   pnpm dev
   ```

2. Navigate to `http://localhost:3000/calendar`

3. Click the **"Add Google Calendar Account"** button

4. You should see a Google sign-in popup

5. Sign in with your Google account (must be a test user you added earlier)

6. Grant the requested permissions

7. Your calendar events should now appear in the application

## Troubleshooting

> **Note:** For NextAuth.js-specific errors (like "Configuration" error), see [nextauth-troubleshooting.md](./nextauth-troubleshooting.md).

### Error: "Configuration" (NextAuth.js)

- **Cause**: Missing or incorrect redirect URI in Google Cloud Console
- **Solution**: Add `http://localhost:3000/api/auth/callback/google` to your OAuth client's Authorized redirect URIs. See [NextAuth Troubleshooting](./nextauth-troubleshooting.md) for detailed steps.

### Error: "Access blocked: This app's request is invalid"

- **Cause**: OAuth consent screen is not properly configured
- **Solution**: Make sure you've added your email as a test user in the OAuth consent screen

### Error: "redirect_uri_mismatch"

- **Cause**: The URL you're accessing doesn't match the authorized redirect URIs
- **Solution**: Add the exact URL (including port) to the authorized redirect URIs in your OAuth client configuration

### Error: "API key not valid"

- **Cause**: API key restrictions may be blocking the request
- **Solution**: Check that the API key has Google Calendar API enabled in its restrictions

### Events Not Showing

- **Cause**: You may not have granted calendar access permissions
- **Solution**:
  1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
  2. Find your "Wall Calendar" app
  3. Click on it and verify that calendar access is enabled
  4. If not, remove the app and re-authenticate

### "This app isn't verified" Warning

- **Cause**: Your app is in testing mode and hasn't been verified by Google
- **Solution**: This is normal for development. Click "Advanced" and then "Go to [App Name] (unsafe)" to continue. For production use, you'll need to submit your app for verification.

## Production Deployment

When deploying to production:

1. Update your OAuth client's authorized JavaScript origins and redirect URIs to include your production domain
2. Add production environment variables to your hosting platform
3. Consider submitting your app for Google verification if you'll have users outside your test user list
4. Keep your API key and Client ID secure - never commit them to version control

## Security Best Practices

- ✅ **DO** use environment variables for credentials
- ✅ **DO** restrict your API key to only the APIs you need
- ✅ **DO** add domain restrictions to your API key
- ✅ **DO** use HTTPS in production
- ✅ **DO** keep your Client Secret secure (server-side only)
- ❌ **DON'T** commit credentials to version control
- ❌ **DON'T** share your API key, Client ID, or Client Secret publicly
- ❌ **DON'T** expose the Client Secret in client-side code
- ❌ **DON'T** request more permissions than you need

## How Token Refresh Works

The application automatically refreshes expired access tokens using the refresh token obtained during the initial sign-in:

1. When you first sign in, Google provides both an **access token** (expires in ~1 hour) and a **refresh token** (long-lived)
2. Both tokens are securely stored in browser localStorage
3. Before fetching calendar events, the app checks if the access token is expired or expiring soon (within 5 minutes)
4. If expired, the app makes a server-side API call to exchange the refresh token for a new access token
5. The new access token is stored and used for subsequent API calls
6. This happens automatically in the background - no user interaction needed

**Note**: If the refresh token becomes invalid (e.g., user revokes permissions), you'll need to remove and re-add the calendar account.

## Additional Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Google API Console](https://console.developers.google.com/)
