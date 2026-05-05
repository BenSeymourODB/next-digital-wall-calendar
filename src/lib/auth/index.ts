// Re-export all auth utilities for convenient imports
export { auth, handlers, signIn, signOut } from "./auth";
export {
  accountHasScope,
  assertGoogleTasksScope,
  AuthError,
  getAccessToken,
  getCurrentUser,
  getGoogleAccount,
  getSession,
  GOOGLE_TASKS_SCOPE,
  isAuthenticated,
  needsReauthentication,
  requireAuth,
  withAuth,
} from "./helpers";
