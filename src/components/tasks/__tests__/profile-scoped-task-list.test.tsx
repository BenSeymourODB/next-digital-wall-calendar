/**
 * Tests for ProfileScopedTaskList β€" the wrapper that bridges the
 * surrounding ProfileContext into a TaskList's per-profile filter.
 */
import {
  ProfileProvider,
  useProfile,
} from "@/components/profiles/profile-context";
import { type ReactNode } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileScopedTaskList } from "../profile-scoped-task-list";
import { TaskList } from "../task-list";
import type { TaskListConfig } from "../types";

// Mock the underlying TaskList so we can assert on the effective config
// it receives without exercising the full hook + UI tree.
vi.mock("../task-list", () => ({
  TaskList: vi.fn(() => null),
}));

const mockTaskList = vi.mocked(TaskList);

const mockProfiles = [
  {
    id: "profile-admin-1",
    userId: "user-1",
    name: "Admin",
    type: "admin",
    ageGroup: "adult",
    color: "#3b82f6",
    avatar: { type: "initials", value: "AU" },
    pinEnabled: false,
    isActive: true,
  },
  {
    id: "profile-kid-1",
    userId: "user-1",
    name: "Kid",
    type: "standard",
    ageGroup: "child",
    color: "#22c55e",
    avatar: { type: "emoji", value: "👦" },
    pinEnabled: false,
    isActive: true,
  },
];

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageStore: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => localStorageStore[k] ?? null,
  setItem: (k: string, v: string) => {
    localStorageStore[k] = v;
  },
  removeItem: (k: string) => {
    delete localStorageStore[k];
  },
  clear: () => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  },
});

const baseConfig: TaskListConfig = {
  id: "config-1",
  title: "My Tasks",
  showCompleted: false,
  sortBy: "dueDate",
  lists: [
    { listId: "list-1", listTitle: "Work", color: "#3b82f6", enabled: true },
  ],
};

function withProvider(children: ReactNode) {
  return <ProfileProvider>{children}</ProfileProvider>;
}

async function getEffectiveConfig(): Promise<TaskListConfig> {
  await waitFor(() => {
    expect(mockTaskList).toHaveBeenCalled();
  });
  // Take the most recent render β€" earlier renders may have been with
  // a still-loading ProfileContext (no active profile yet).
  const calls = mockTaskList.mock.calls;
  const latest = calls[calls.length - 1][0] as { config: TaskListConfig };
  return latest.config;
}

describe("ProfileScopedTaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfiles),
    });
  });

  it("scopes the filter to the active profile in profile view mode", async () => {
    render(withProvider(<ProfileScopedTaskList config={baseConfig} />));

    await waitFor(async () => {
      const config = await getEffectiveConfig();
      // Default profile is the first admin β€" `profile-admin-1`.
      expect(config.profileFilter).toBe("profile-admin-1");
    });
  });

  it("includes unassigned tasks by default", async () => {
    render(withProvider(<ProfileScopedTaskList config={baseConfig} />));

    await waitFor(async () => {
      const config = await getEffectiveConfig();
      expect(config.showUnassigned).toBe(true);
    });
  });

  it("respects showUnassigned=false override", async () => {
    render(
      withProvider(
        <ProfileScopedTaskList config={baseConfig} showUnassigned={false} />
      )
    );

    await waitFor(async () => {
      const config = await getEffectiveConfig();
      expect(config.showUnassigned).toBe(false);
    });
  });

  it("respects an explicit profileFilter on the config", async () => {
    const overridden: TaskListConfig = {
      ...baseConfig,
      profileFilter: "profile-kid-1",
    };

    render(withProvider(<ProfileScopedTaskList config={overridden} />));

    await waitFor(async () => {
      const config = await getEffectiveConfig();
      expect(config.profileFilter).toBe("profile-kid-1");
    });
  });

  it("clears the filter when no profile is active", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(withProvider(<ProfileScopedTaskList config={baseConfig} />));

    await waitFor(async () => {
      const config = await getEffectiveConfig();
      expect(config.profileFilter).toBeNull();
    });
  });

  it("clears the filter in family view mode even when a profile is active", async () => {
    function FamilyToggle() {
      const { setViewMode } = useProfile();
      return (
        <button
          type="button"
          onClick={() => setViewMode("family")}
          data-testid="enter-family-mode"
        >
          Family
        </button>
      );
    }

    render(
      withProvider(
        <>
          <FamilyToggle />
          <ProfileScopedTaskList config={baseConfig} />
        </>
      )
    );

    // Wait for the profile to load and the initial profile-mode render
    // to settle β€" baseline `profileFilter` is the active profile id.
    await waitFor(async () => {
      const config = await getEffectiveConfig();
      expect(config.profileFilter).toBe("profile-admin-1");
    });

    act(() => {
      fireEvent.click(
        document.querySelector(
          '[data-testid="enter-family-mode"]'
        ) as HTMLElement
      );
    });

    await waitFor(async () => {
      const config = await getEffectiveConfig();
      // Family mode wins even though `activeProfile` is still set.
      expect(config.profileFilter).toBeNull();
    });
  });
});
