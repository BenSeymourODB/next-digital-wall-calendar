import type { Profile as AppProfile } from "@/components/profiles/types";
import type {
  Profile as PrismaProfile,
  ProfileSettings as PrismaProfileSettings,
} from "@/generated/prisma/client";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  makePrismaProfile,
  makeProfile,
  makeProfileSettings,
} from "../profile";

/**
 * Locks in the contract of the shared Profile / ProfileSettings test
 * fixtures. Issue #371: adding one field to `Profile` / `ProfileSettings`
 * forced near-identical edits across ~13 test files. The factories collapse
 * that to a single edit here.
 */
describe("makeProfile", () => {
  it("returns sensible defaults assignable to the app-level Profile", () => {
    const profile = makeProfile();

    expect(profile.id).toBe("profile-1");
    expect(profile.userId).toBe("test-user-123");
    expect(profile.name).toBe("Test Profile");
    expect(profile.type).toBe("admin");
    expect(profile.ageGroup).toBe("adult");
    expect(profile.color).toBe("#3b82f6");
    expect(profile.pinEnabled).toBe(false);
    expect(profile.isActive).toBe(true);
    expect(profile.avatar).toEqual({
      type: "initials",
      value: "TP",
      backgroundColor: "#3b82f6",
    });

    // Type-level check: assignable to the app Profile interface.
    expectTypeOf(profile).toMatchTypeOf<AppProfile>();
  });

  it("merges overrides on top of defaults", () => {
    const profile = makeProfile({
      id: "p-7",
      name: "Child User",
      type: "standard",
      ageGroup: "child",
      pinEnabled: true,
    });

    expect(profile.id).toBe("p-7");
    expect(profile.name).toBe("Child User");
    expect(profile.type).toBe("standard");
    expect(profile.ageGroup).toBe("child");
    expect(profile.pinEnabled).toBe(true);
    // Untouched defaults remain
    expect(profile.color).toBe("#3b82f6");
    expect(profile.isActive).toBe(true);
  });

  it("accepts a nested avatar override without forcing the caller to repeat unrelated fields", () => {
    const profile = makeProfile({
      avatar: { type: "emoji", value: "👧" },
    });

    expect(profile.avatar).toEqual({ type: "emoji", value: "👧" });
  });

  it("does not include Prisma-only security fields", () => {
    const profile = makeProfile();
    expect(profile).not.toHaveProperty("pinHash");
    expect(profile).not.toHaveProperty("failedPinAttempts");
    expect(profile).not.toHaveProperty("pinLockedUntil");
  });
});

describe("makePrismaProfile", () => {
  it("returns sensible defaults assignable to the Prisma Profile row", () => {
    const profile = makePrismaProfile();

    expect(profile.id).toBe("profile-1");
    expect(profile.userId).toBe("test-user-123");
    expect(profile.name).toBe("Test Profile");
    expect(profile.type).toBe("admin");
    expect(profile.ageGroup).toBe("adult");
    expect(profile.pinEnabled).toBe(false);
    expect(profile.failedPinAttempts).toBe(0);
    expect(profile.pinLockedUntil).toBeNull();
    expect(profile.pinHash).toBeNull();
    expect(profile.isActive).toBe(true);
    expect(profile.createdAt).toBeInstanceOf(Date);
    expect(profile.updatedAt).toBeInstanceOf(Date);

    // The factory returns a value assignable to the Prisma row, so it can
    // be handed directly to `mockResolvedValue` / `mockReturnValue`.
    expectTypeOf(profile).toMatchTypeOf<PrismaProfile>();
  });

  it("merges overrides — including PIN security fields", () => {
    const lockedUntil = new Date("2030-01-01T00:00:00Z");
    const profile = makePrismaProfile({
      pinHash: "$2b$10$hash",
      pinEnabled: true,
      failedPinAttempts: 3,
      pinLockedUntil: lockedUntil,
    });

    expect(profile.pinHash).toBe("$2b$10$hash");
    expect(profile.pinEnabled).toBe(true);
    expect(profile.failedPinAttempts).toBe(3);
    expect(profile.pinLockedUntil).toBe(lockedUntil);
  });
});

describe("makeProfileSettings", () => {
  it("returns defaults aligned with the schema @default(...) values", () => {
    const settings = makeProfileSettings();

    expect(settings.id).toBe("profile-settings-1");
    expect(settings.profileId).toBe("profile-1");
    expect(settings.defaultTaskListId).toBeNull();
    expect(settings.showCompletedTasks).toBe(false);
    expect(settings.taskSortOrder).toBe("dueDate");
    expect(settings.theme).toBe("light");
    expect(settings.language).toBe("en");
    expect(settings.enableNotifications).toBe(false);
    expect(settings.notificationTime).toBeNull();

    expectTypeOf(settings).toMatchTypeOf<PrismaProfileSettings>();
  });

  it("merges overrides on top of defaults", () => {
    const settings = makeProfileSettings({
      theme: "dark",
      enableNotifications: true,
      notificationTime: "09:30",
      taskSortOrder: "priority",
    });

    expect(settings.theme).toBe("dark");
    expect(settings.enableNotifications).toBe(true);
    expect(settings.notificationTime).toBe("09:30");
    expect(settings.taskSortOrder).toBe("priority");
    // Untouched defaults remain
    expect(settings.profileId).toBe("profile-1");
    expect(settings.showCompletedTasks).toBe(false);
  });
});
