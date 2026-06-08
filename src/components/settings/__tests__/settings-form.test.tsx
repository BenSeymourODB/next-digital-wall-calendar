/**
 * Tests for SettingsForm — focused on the profile-scoped Tasks settings wiring
 * added for #334. The form is server-rendered with `initialSettings` (UserSettings),
 * but Tasks settings live on `ProfileSettings` and must be fetched client-side
 * for the active profile.
 */
import { useProfile } from "@/components/profiles/profile-context";
import { makeUserSettings } from "@/test/fixtures/user-settings";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "../settings-form";

vi.mock("@/components/profiles/profile-context", () => ({
  useProfile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/scheduler/schedule-storage", () => ({
  loadScheduleConfig: vi.fn(() => ({ transition: undefined })),
  saveScheduleConfig: vi.fn(),
}));

const baseInitialSettings = makeUserSettings();

const baseUser = {
  name: "Test User",
  email: "test@example.com",
  image: null,
};

const ACTIVE_PROFILE_ID = "profile-active-1";

function mockActiveProfile(id: string | null) {
  vi.mocked(useProfile).mockReturnValue({
    activeProfile: id
      ? {
          id,
          userId: "user-1",
          name: "Active",
          type: "admin",
          ageGroup: "adult",
          color: "#3b82f6",
          avatar: { type: "initials", value: "A" },
          pinEnabled: false,
          isActive: true,
        }
      : null,
    allProfiles: [],
    viewMode: "profile",
    isAdmin: true,
    isLoading: false,
    setActiveProfile: vi.fn(),
    setViewMode: vi.fn(),
    refreshProfiles: vi.fn(),
  });
}

function renderSettings() {
  return render(
    <SettingsForm
      user={baseUser}
      createdAt="2024-01-01T00:00:00Z"
      providers={["google"]}
      initialSettings={baseInitialSettings}
    />
  );
}

describe("SettingsForm — Tasks settings wiring (#334)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile(ACTIVE_PROFILE_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches profile settings for the active profile on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        taskSortOrder: "title",
        showCompletedTasks: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/profiles/${ACTIVE_PROFILE_ID}/settings`
      );
    });
  });

  it("renders fetched showCompletedTasks value once load resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          taskSortOrder: "title",
          showCompletedTasks: true,
        }),
      })
    );

    renderSettings();

    const switchEl = await screen.findByRole("switch", {
      name: /show completed tasks/i,
    });
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "checked")
    );
  });

  it("does not fetch when no active profile is available", async () => {
    mockActiveProfile(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();

    // Wait for effects to settle — if the no-active-profile guard were
    // removed, fetch would be called asynchronously and a synchronous
    // assertion would miss it.
    await act(async () => {
      await Promise.resolve();
    });

    const profileSettingsFetch = fetchMock.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("/settings")
    );
    expect(profileSettingsFetch).toBeUndefined();
  });

  it("shows fallback defaults (unchecked) while the fetch is still pending", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingFetch));

    renderSettings();

    const switchEl = await screen.findByRole("switch", {
      name: /show completed tasks/i,
    });

    // Settings would say `showCompletedTasks: true`, but the promise hasn't
    // resolved, so the component must still show the unchecked default.
    expect(switchEl).toHaveAttribute("data-state", "unchecked");

    // Resolve so the cleanup effect doesn't leak.
    resolveFetch?.({
      ok: true,
      json: async () => ({
        taskSortOrder: "dueDate",
        showCompletedTasks: true,
      }),
    });
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "checked")
    );
  });

  it("PUTs to the active profile's settings endpoint when showCompletedTasks toggles", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      // GET on mount
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "dueDate",
          showCompletedTasks: false,
        }),
      })
      // PUT on toggle
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "dueDate",
          showCompletedTasks: true,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();

    const switchEl = await screen.findByRole("switch", {
      name: /show completed tasks/i,
    });

    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "unchecked")
    );

    await user.click(switchEl);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((call) => {
        const url = call[0] as string;
        const init = call[1] as RequestInit | undefined;
        return (
          url === `/api/profiles/${ACTIVE_PROFILE_ID}/settings` &&
          init?.method === "PUT"
        );
      });
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        showCompletedTasks: boolean;
      };
      expect(body.showCompletedTasks).toBe(true);
    });

    expect(switchEl).toHaveAttribute("data-state", "checked");
  });

  it("PUTs the new taskSortOrder when the sort-order Select changes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "dueDate",
          showCompletedTasks: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "priority",
          showCompletedTasks: false,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();

    // Wait until the GET resolves and the section is fully wired.
    await screen.findByRole("switch", { name: /show completed tasks/i });

    // SettingsForm has several Select dropdowns (timeFormat, dateFormat,
    // taskSortOrder, …) — the only one initialised to "Due Date" is the
    // task-sort-order one.
    const combobox = screen
      .getAllByRole("combobox")
      .find((el) => /due date/i.test(el.textContent ?? ""));
    expect(combobox).toBeDefined();
    await user.click(combobox!);
    const option = await screen.findByRole("option", { name: /priority/i });
    await user.click(option);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find((call) => {
        const url = call[0] as string;
        const init = call[1] as RequestInit | undefined;
        return (
          url === `/api/profiles/${ACTIVE_PROFILE_ID}/settings` &&
          init?.method === "PUT"
        );
      });
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        taskSortOrder: string;
      };
      expect(body.taskSortOrder).toBe("priority");
    });
  });

  it("rolls back optimistic toggle and toasts on PUT failure", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "dueDate",
          showCompletedTasks: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "boom" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();

    const switchEl = await screen.findByRole("switch", {
      name: /show completed tasks/i,
    });
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "unchecked")
    );

    await user.click(switchEl);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
  });

  it("re-fetches and updates display when the active profile changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "dueDate",
          showCompletedTasks: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskSortOrder: "title",
          showCompletedTasks: true,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderSettings();

    const switchEl = await screen.findByRole("switch", {
      name: /show completed tasks/i,
    });
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "unchecked")
    );

    mockActiveProfile("profile-other-2");
    rerender(
      <SettingsForm
        user={baseUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        initialSettings={baseInitialSettings}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profiles/profile-other-2/settings"
      );
    });
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "checked")
    );
  });
});

/**
 * Tests for SettingsForm optimistic-update rollback semantics (#363).
 *
 * The rollback path must restore the pre-call value of *only* the fields
 * being updated, read from the truly-current state via the functional
 * setter — not a stale closure of the entire settings object. Without
 * this, an overlapping successful PUT to a different key loses its
 * optimistic state when an earlier PUT to a different key fails.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SettingsForm — updateSettings rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile(ACTIVE_PROFILE_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rolls back to the pre-call value when a single PUT fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (typeof url === "string" && url.startsWith("/api/profiles/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              taskSortOrder: "dueDate",
              showCompletedTasks: false,
            }),
          } as unknown as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      })
    );

    renderSettings();

    const lightRadio = screen.getByLabelText(/^light$/i);
    const darkRadio = screen.getByLabelText(/^dark$/i);
    expect(lightRadio).toBeChecked();

    await user.click(darkRadio);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });

    expect(lightRadio).toBeChecked();
    expect(darkRadio).not.toBeChecked();
  });

  it("preserves a concurrent successful PUT when an earlier PUT fails", async () => {
    const user = userEvent.setup();
    const first = deferred<Response>();
    const second = deferred<Response>();
    let userSettingsCallIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        // The profile-settings GET fires on mount; let it resolve immediately
        // so the form is fully wired before we click. Only the two /api/settings
        // PUTs are the ones under test.
        if (typeof url === "string" && url.startsWith("/api/profiles/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              taskSortOrder: "dueDate",
              showCompletedTasks: false,
            }),
          } as unknown as Response);
        }
        userSettingsCallIndex += 1;
        return userSettingsCallIndex === 1 ? first.promise : second.promise;
      })
    );

    renderSettings();

    const lightRadio = screen.getByLabelText(/^light$/i);
    const darkRadio = screen.getByLabelText(/^dark$/i);
    const twelveHourRadio = screen.getByLabelText(/12-hour/i);
    const twentyFourHourRadio = screen.getByLabelText(/24-hour/i);

    await user.click(darkRadio);
    await user.click(twentyFourHourRadio);

    expect(darkRadio).toBeChecked();
    expect(twentyFourHourRadio).toBeChecked();

    second.resolve({ ok: true } as Response);
    first.reject(new Error("network failure"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });

    // Theme reverts (its PUT failed)…
    expect(lightRadio).toBeChecked();
    expect(darkRadio).not.toBeChecked();
    // …but the time-format change must NOT be wiped by the failed theme PUT's
    // rollback — its own PUT succeeded.
    expect(twentyFourHourRadio).toBeChecked();
    expect(twelveHourRadio).not.toBeChecked();
  });

  it("does not roll back when the PUT succeeds", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.startsWith("/api/profiles/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            taskSortOrder: "dueDate",
            showCompletedTasks: false,
          }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();

    const darkRadio = screen.getByLabelText(/^dark$/i);
    await user.click(darkRadio);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ theme: "dark" }),
        })
      );
    });

    expect(darkRadio).toBeChecked();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
