/**
 * Tab-local pub/sub bus for cross-surface `UserSettings` updates (#337).
 *
 * Two consumers in the same tab — `CalendarSettingsPanel` (via
 * `CalendarProvider` / `useUserSettings`) and the main Settings page
 * (`SettingsForm` → `DisplaySection`) — both PUT to `/api/settings`. Without
 * a bus, a write from one surface is invisible to the other until the next
 * reload, so the two drift apart visually for the rest of the session.
 *
 * The bus is intentionally tab-local: a CustomEvent on `window`. It is not
 * a replacement for the storage event (that handles cross-tab sync, which
 * is out of scope here) — it just gives every in-tab subscriber a chance
 * to react to a mutation as soon as it lands.
 *
 * Server-safe: `window` is guarded so the module can be imported from
 * places that load on the server (e.g. shared hooks).
 */

const EVENT_NAME = "user-settings-changed";

export type UserSettingsPartial = Record<string, unknown>;

/**
 * Notify every in-tab subscriber that a partial of `UserSettings` has been
 * persisted. Callers must have already sent the PUT to the server — the
 * bus is for visual sync only, never for storage.
 */
export function emitUserSettingsChange(partial: UserSettingsPartial): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: partial }));
}

/**
 * Subscribe to in-tab user-settings mutations. Returns an unsubscribe fn
 * that's safe to call multiple times.
 */
export function subscribeUserSettings(
  handler: (partial: UserSettingsPartial) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = (e: Event) => {
    const ce = e as CustomEvent<UserSettingsPartial>;
    handler(ce.detail);
  };
  window.addEventListener(EVENT_NAME, wrapped);
  return () => window.removeEventListener(EVENT_NAME, wrapped);
}
