import {
  DEFAULT_FILTER_STATE,
  clearFilterState,
  filterStorageKey,
  getActiveProfileId,
  loadFilterState,
  saveFilterState,
} from "@/lib/calendar-filter-storage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("calendar-filter-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe("filterStorageKey", () => {
    it("returns calendar-filters:default when profileId is null", () => {
      expect(filterStorageKey(null)).toBe("calendar-filters:default");
    });

    it("namespaces by profileId", () => {
      expect(filterStorageKey("profile-a")).toBe("calendar-filters:profile-a");
      expect(filterStorageKey("profile-b")).toBe("calendar-filters:profile-b");
    });
  });

  describe("getActiveProfileId", () => {
    it("returns null when activeProfileId is not set", () => {
      expect(getActiveProfileId()).toBeNull();
    });

    it("returns the stored activeProfileId", () => {
      window.localStorage.setItem("activeProfileId", "abc");
      expect(getActiveProfileId()).toBe("abc");
    });
  });

  describe("loadFilterState", () => {
    it("returns defaults when nothing is stored", () => {
      expect(loadFilterState("profile-a")).toEqual(DEFAULT_FILTER_STATE);
    });

    it("returns the stored filter state for the given profile", () => {
      const state = {
        selectedColors: ["red", "blue"],
        selectedUserId: "user-1",
        selectedCalendarIds: ["cal-1"],
      };
      window.localStorage.setItem(
        "calendar-filters:profile-a",
        JSON.stringify(state)
      );
      expect(loadFilterState("profile-a")).toEqual(state);
    });

    it("isolates state by profile", () => {
      window.localStorage.setItem(
        "calendar-filters:profile-a",
        JSON.stringify({
          selectedColors: ["red"],
          selectedUserId: "u1",
          selectedCalendarIds: [],
        })
      );
      window.localStorage.setItem(
        "calendar-filters:profile-b",
        JSON.stringify({
          selectedColors: ["green"],
          selectedUserId: "u2",
          selectedCalendarIds: ["cal-2"],
        })
      );

      expect(loadFilterState("profile-a").selectedColors).toEqual(["red"]);
      expect(loadFilterState("profile-b").selectedColors).toEqual(["green"]);
      expect(loadFilterState("profile-b").selectedCalendarIds).toEqual([
        "cal-2",
      ]);
    });

    it("falls back to defaults when stored payload is unparseable", () => {
      window.localStorage.setItem("calendar-filters:profile-a", "not-json");
      expect(loadFilterState("profile-a")).toEqual(DEFAULT_FILTER_STATE);
    });

    it("drops invalid colors from the stored payload", () => {
      window.localStorage.setItem(
        "calendar-filters:profile-a",
        JSON.stringify({
          selectedColors: ["red", "not-a-color", "blue"],
          selectedUserId: "all",
          selectedCalendarIds: [],
        })
      );
      expect(loadFilterState("profile-a").selectedColors).toEqual([
        "red",
        "blue",
      ]);
    });

    it("drops non-string entries from selectedCalendarIds", () => {
      window.localStorage.setItem(
        "calendar-filters:profile-a",
        JSON.stringify({
          selectedColors: [],
          selectedUserId: "all",
          selectedCalendarIds: ["cal-1", 42, null, "cal-2"],
        })
      );
      expect(loadFilterState("profile-a").selectedCalendarIds).toEqual([
        "cal-1",
        "cal-2",
      ]);
    });

    it("falls back to all when selectedUserId is missing or non-string", () => {
      window.localStorage.setItem(
        "calendar-filters:profile-a",
        JSON.stringify({ selectedColors: [], selectedCalendarIds: [] })
      );
      expect(loadFilterState("profile-a").selectedUserId).toBe("all");
    });

    it("uses 'default' as the fallback profile id", () => {
      window.localStorage.setItem(
        "calendar-filters:default",
        JSON.stringify({
          selectedColors: ["red"],
          selectedUserId: "all",
          selectedCalendarIds: [],
        })
      );
      expect(loadFilterState(null).selectedColors).toEqual(["red"]);
    });
  });

  describe("saveFilterState", () => {
    it("writes the state to the per-profile key", () => {
      saveFilterState("profile-a", {
        selectedColors: ["yellow"],
        selectedUserId: "user-1",
        selectedCalendarIds: ["cal-1", "cal-2"],
      });
      const raw = window.localStorage.getItem("calendar-filters:profile-a");
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual({
        selectedColors: ["yellow"],
        selectedUserId: "user-1",
        selectedCalendarIds: ["cal-1", "cal-2"],
      });
    });

    it("does not affect other profiles' stored state", () => {
      saveFilterState("profile-a", {
        selectedColors: ["red"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      });
      saveFilterState("profile-b", {
        selectedColors: ["blue"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      });
      expect(loadFilterState("profile-a").selectedColors).toEqual(["red"]);
      expect(loadFilterState("profile-b").selectedColors).toEqual(["blue"]);
    });
  });

  describe("clearFilterState", () => {
    it("removes the stored state for the given profile", () => {
      saveFilterState("profile-a", {
        selectedColors: ["red"],
        selectedUserId: "u1",
        selectedCalendarIds: [],
      });
      clearFilterState("profile-a");
      expect(
        window.localStorage.getItem("calendar-filters:profile-a")
      ).toBeNull();
    });

    it("does not touch other profiles' stored state", () => {
      saveFilterState("profile-a", {
        selectedColors: ["red"],
        selectedUserId: "u1",
        selectedCalendarIds: [],
      });
      saveFilterState("profile-b", {
        selectedColors: ["green"],
        selectedUserId: "u2",
        selectedCalendarIds: [],
      });
      clearFilterState("profile-a");
      expect(loadFilterState("profile-b").selectedColors).toEqual(["green"]);
    });
  });
});
