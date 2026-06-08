/**
 * LocalStorage-backed persistence for calendar filter selections (issue
 * #208). Filter state is keyed by the active profile id so each family
 * member's selections are isolated. The active profile id is read from
 * the same `activeProfileId` key that ProfileProvider writes, keeping
 * the two providers decoupled — neither imports the other.
 */
import type { TEventColor } from "@/types/calendar";

const FILTER_STORAGE_PREFIX = "calendar-filters";
const ACTIVE_PROFILE_KEY = "activeProfileId";
const DEFAULT_PROFILE_BUCKET = "default";

const VALID_COLORS: readonly TEventColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
] as const;

export interface StoredFilterState {
  selectedColors: TEventColor[];
  selectedUserId: string;
  selectedCalendarIds: string[];
}

export const DEFAULT_FILTER_STATE: StoredFilterState = {
  selectedColors: [],
  selectedUserId: "all",
  selectedCalendarIds: [],
};

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function filterStorageKey(profileId: string | null): string {
  return `${FILTER_STORAGE_PREFIX}:${profileId ?? DEFAULT_PROFILE_BUCKET}`;
}

function isValidColor(value: unknown): value is TEventColor {
  return (
    typeof value === "string" && VALID_COLORS.includes(value as TEventColor)
  );
}

export function loadFilterState(profileId: string | null): StoredFilterState {
  if (typeof window === "undefined") return DEFAULT_FILTER_STATE;

  try {
    const raw = window.localStorage.getItem(filterStorageKey(profileId));
    if (!raw) return DEFAULT_FILTER_STATE;

    const parsed = JSON.parse(raw) as Partial<StoredFilterState>;
    return {
      selectedColors: Array.isArray(parsed.selectedColors)
        ? parsed.selectedColors.filter(isValidColor)
        : [],
      selectedUserId:
        typeof parsed.selectedUserId === "string"
          ? parsed.selectedUserId
          : "all",
      selectedCalendarIds: Array.isArray(parsed.selectedCalendarIds)
        ? parsed.selectedCalendarIds.filter(
            (id): id is string => typeof id === "string"
          )
        : [],
    };
  } catch {
    return DEFAULT_FILTER_STATE;
  }
}

export function saveFilterState(
  profileId: string | null,
  state: StoredFilterState
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      filterStorageKey(profileId),
      JSON.stringify(state)
    );
  } catch {
    // Storage quota or privacy mode — drop silently. Filter persistence
    // is a UX nicety, not a correctness requirement.
  }
}

export function clearFilterState(profileId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(filterStorageKey(profileId));
  } catch {
    // noop — see saveFilterState.
  }
}
