/**
 * Tests for SettingsForm — focused on the profile-scoped Tasks settings wiring
 * added for #334. The form is server-rendered with `initialSettings` (UserSettings),
 * but Tasks settings live on `ProfileSettings` and must be fetched client-side
 * for the active profile.
 */
import { useProfile } from "@/components/profiles/profile-context";
import {
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import { makeProfile } from "@/test/fixtures/profile";
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
      ? makeProfile({
          id,
          userId: "user-1",
          name: "Active",
          avatar: { type: "initials", value: "A" },
        })
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

/**
 * Tests for SettingsForm — bus-rollback semantics (#414).
 *
 * `emitUserSettingsChange` fires on PUT success so in-tab subscribers (e.g.
 * `CalendarProvider` via `useUserSettings`) stay in sync. The catch path
 * must mirror that emit with the *reverted* partial — without it, any
 * subscriber that consumed an earlier optimistic emit (e.g. via a
 * preceding successful PUT to the same key, or a future move of the emit
 * to the optimistic path) would be left holding a stale value until the
 * next refresh.
 */
describe("SettingsForm — bus rollback on PUT failure (#414)", () => {
  // Hold the per-test bus unsubscribe so afterEach can run it unconditionally
  // even if a test throws before reaching its own teardown line. Without this,
  // an aborted test's subscriber would leak into the next case and start
  // receiving its emits.
  let unsubscribeBus: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile(ACTIVE_PROFILE_ID);
    unsubscribeBus = undefined;
  });

  afterEach(() => {
    unsubscribeBus?.();
    unsubscribeBus = undefined;
    vi.unstubAllGlobals();
  });

  it("emits the reverted partial on the user-settings bus when a PUT fails", async () => {
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

    const busHandler = vi.fn();
    unsubscribeBus = subscribeUserSettings(busHandler);

    renderSettings();

    // Wait for the profile-settings GET to settle so the form is fully
    // wired before driving the theme change.
    await screen.findByRole("switch", { name: /show completed tasks/i });

    const darkRadio = screen.getByLabelText(/^dark$/i);
    await user.click(darkRadio);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });

    // The bus subscriber must observe the rollback: the pre-call
    // theme ("light"), not the optimistic value ("dark"). Asserting on the
    // exact call count guards against a future refactor that emits
    // optimistically before the PUT — that would still satisfy a bare
    // `toHaveBeenCalledWith(...)` matcher.
    expect(busHandler).toHaveBeenCalledTimes(1);
    expect(busHandler).toHaveBeenCalledWith({ theme: "light" });
  });

  it("emits exactly once (the optimistic partial) when the PUT succeeds", async () => {
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
        return Promise.resolve({ ok: true } as Response);
      })
    );

    const busHandler = vi.fn();
    unsubscribeBus = subscribeUserSettings(busHandler);

    renderSettings();

    await screen.findByRole("switch", { name: /show completed tasks/i });

    const darkRadio = screen.getByLabelText(/^dark$/i);
    await user.click(darkRadio);

    await waitFor(() => {
      expect(busHandler).toHaveBeenCalledWith({ theme: "dark" });
    });

    // A single microtask flush is sufficient here because the failure path
    // throws synchronously off the `response.ok` check and the catch fires
    // in the same microtask chain — no awaited steps between throw and
    // `emitUserSettingsChange`. If a future refactor inserts an `await`
    // between them, this flush would need to grow.
    await act(async () => {
      await Promise.resolve();
    });

    expect(busHandler).toHaveBeenCalledTimes(1);
    expect(busHandler).not.toHaveBeenCalledWith({ theme: "light" });
  });
});

/**
 * Tests for SettingsForm — same-key rollback race (#420).
 *
 * Two `updateSettings` calls in flight on the same key. The second succeeds,
 * the first fails. The first's rollback path must NOT regress the second's
 * successful value — neither in local form state nor on the user-settings
 * bus. Without the guard, the failed call's `previousPartial` snapshot
 * (captured from the second call's optimistic value) becomes the rolled-back
 * value, stomping on the most-recent committed truth.
 */
describe("SettingsForm — same-key rollback race (#420)", () => {
  let unsubscribeBus: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile(ACTIVE_PROFILE_ID);
    unsubscribeBus = undefined;
  });

  afterEach(() => {
    unsubscribeBus?.();
    unsubscribeBus = undefined;
    vi.unstubAllGlobals();
  });

  it("does not emit the stale snapshot on the bus when a later same-key PUT succeeded", async () => {
    const user = userEvent.setup();
    const first = deferred<Response>();
    const second = deferred<Response>();
    let userSettingsCallIndex = 0;
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
        userSettingsCallIndex += 1;
        return userSettingsCallIndex === 1 ? first.promise : second.promise;
      })
    );

    const busHandler = vi.fn();
    unsubscribeBus = subscribeUserSettings(busHandler);

    renderSettings();

    await screen.findByRole("switch", { name: /show completed tasks/i });

    const lightRadio = screen.getByLabelText(/^light$/i);
    const darkRadio = screen.getByLabelText(/^dark$/i);
    const systemRadio = screen.getByLabelText(/^system$/i);

    // A then B on the same key — `theme`. B captures A's optimistic value
    // ("dark") as its `previousPartial`; A captured the original ("light").
    await user.click(darkRadio);
    await user.click(systemRadio);

    // Resolve B first (success), then fail A. The order matters — we need
    // B's success emit to land before A's catch path runs.
    second.resolve({ ok: true } as Response);
    first.reject(new Error("network failure"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });

    // Bus subscribers must hold B's value, not A's pre-call snapshot.
    expect(busHandler).not.toHaveBeenCalledWith({ theme: "light" });
    // B's optimistic emit must still have landed.
    expect(busHandler).toHaveBeenCalledWith({ theme: "system" });

    // Local form must also hold B's value, not A's pre-call snapshot.
    expect(systemRadio).toBeChecked();
    expect(darkRadio).not.toBeChecked();
    expect(lightRadio).not.toBeChecked();
  });

  it("still emits the rolled-back partial when no concurrent same-key PUT touched the field", async () => {
    // Regression guard for the #414 single-call path — the new race guard
    // must not suppress rollback when no later call has overwritten the key.
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

    const busHandler = vi.fn();
    unsubscribeBus = subscribeUserSettings(busHandler);

    renderSettings();

    await screen.findByRole("switch", { name: /show completed tasks/i });

    const darkRadio = screen.getByLabelText(/^dark$/i);
    await user.click(darkRadio);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings");
    });

    expect(busHandler).toHaveBeenCalledTimes(1);
    expect(busHandler).toHaveBeenCalledWith({ theme: "light" });
  });
});

/**
 * Tests for SettingsForm.updateTaskSettings optimistic-update rollback
 * semantics (#413).
 *
 * Mirrors the #363/#366 rollback contract for the profile-scoped task
 * settings: the failure path must restore the pre-call value of *only*
 * the keys being updated, read from the truly-current state via the
 * functional setter — not a stale closure of the entire
 * `taskSettings` object. Without this, an overlapping successful PUT to
 * a different task-settings key loses its optimistic value when an
 * earlier PUT fails.
 */
describe("SettingsForm — updateTaskSettings rollback (#413)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile(ACTIVE_PROFILE_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves a concurrent successful task-settings PUT when an earlier PUT fails", async () => {
    const user = userEvent.setup();
    const firstPut = deferred<Response>();
    const secondPut = deferred<Response>();
    let putIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (
          typeof url === "string" &&
          url === `/api/profiles/${ACTIVE_PROFILE_ID}/settings`
        ) {
          if (init?.method === "PUT") {
            putIndex += 1;
            return putIndex === 1 ? firstPut.promise : secondPut.promise;
          }
          // GET on mount
          return Promise.resolve({
            ok: true,
            json: async () => ({
              taskSortOrder: "dueDate",
              showCompletedTasks: false,
            }),
          } as unknown as Response);
        }
        return Promise.resolve({ ok: true } as Response);
      })
    );

    renderSettings();

    const switchEl = await screen.findByRole("switch", {
      name: /show completed tasks/i,
    });
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("data-state", "unchecked")
    );

    // PUT #1 — toggle showCompletedTasks on.
    await user.click(switchEl);
    expect(switchEl).toHaveAttribute("data-state", "checked");

    // PUT #2 — change sort order to Priority. The task-sort-order
    // combobox is the only one initialised to "Due Date".
    const combobox = screen
      .getAllByRole("combobox")
      .find((el) => /due date/i.test(el.textContent ?? ""));
    expect(combobox).toBeDefined();
    await user.click(combobox!);
    const option = await screen.findByRole("option", { name: /priority/i });
    await user.click(option);

    // Second resolves OK, first rejects — a whole-object rollback
    // would wipe the successful sort-order change when the toggle
    // reverts.
    secondPut.resolve({ ok: true } as Response);
    firstPut.reject(new Error("network failure"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save task settings");
    });

    // showCompletedTasks reverts (its PUT failed)…
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
    // …but the sort-order change must NOT be wiped by the failed
    // toggle's rollback — its own PUT succeeded. Assert against the
    // original combobox node identity so a different "priority"-bearing
    // element elsewhere on the page cannot satisfy this check.
    expect(combobox).toHaveTextContent(/priority/i);
    expect(combobox).not.toHaveTextContent(/due date/i);
  });
});

/**
 * Tests for SettingsForm — bus subscription (#424).
 *
 * Before this PR the form was a *publisher* on `user-settings-bus`
 * (`emitUserSettingsChange` on PUT success at L149) but never a
 * *subscriber*. With two writers in the same tab (a calendar settings
 * popover, a future tasks settings panel, the `/test/*-sync` fixtures),
 * the form's local copy would drift from `useUserSettings.settings` —
 * an external bus emit would update every other surface but leave the
 * Settings page rendering the stale value until reload.
 *
 * Lost-write reproduction: emit `dateFormat: "DD/MM/YYYY"` from outside,
 * assert `AccountSection` (which reads `settings.dateFormat` via the
 * form) re-renders the user's join date in the new format.
 */
describe("SettingsForm — bus subscription (#424)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveProfile(ACTIVE_PROFILE_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-renders downstream display when an external bus emit changes a settings field", async () => {
    // The profile-settings GET fires on mount; stub it so the form can
    // wire fully before we drive the bus emit.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          taskSortOrder: "dueDate",
          showCompletedTasks: false,
        }),
      })
    );

    // 2024-03-15 reads differently in MM/DD/YYYY ("03/15/2024") and
    // DD/MM/YYYY ("15/03/2024"), so the test is sensitive to the
    // format change rather than coincidentally passing on a symmetric
    // date (e.g. 2024-01-01).
    render(
      <SettingsForm
        user={baseUser}
        createdAt="2024-03-15T00:00:00Z"
        providers={["google"]}
        initialSettings={makeUserSettings({ dateFormat: "MM/DD/YYYY" })}
      />
    );

    await screen.findByRole("switch", { name: /show completed tasks/i });

    expect(screen.getByText(/Member since 03\/15\/2024/)).toBeInTheDocument();

    // Simulate an external writer (e.g. `useUserSettings.mutate` from a
    // calendar settings popover) emitting on the bus. Before #424 the
    // form did not subscribe, so this emit was invisible to the
    // Settings page.
    act(() => {
      emitUserSettingsChange({ dateFormat: "DD/MM/YYYY" });
    });

    await waitFor(() => {
      expect(screen.getByText(/Member since 15\/03\/2024/)).toBeInTheDocument();
    });
  });

  it("does not double-PUT or re-emit when its own updateSettings emit round-trips through the subscription", async () => {
    // Regression guard: the form is both a publisher and a subscriber.
    // A naive subscriber that called `updateSettings` on every bus event
    // would loop indefinitely; merging straight into local state is the
    // correct shape. Assert exactly one PUT and exactly one external
    // bus delivery per user-triggered change.
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/api/profiles/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            taskSortOrder: "dueDate",
            showCompletedTasks: false,
          }),
        } as unknown as Response);
      }
      // Touch `init` so the parameter is observable on the mock's
      // `.calls` typing — without this the inferred signature drops
      // the second argument and the assertion below loses type safety.
      void init;
      return Promise.resolve({ ok: true } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);

    const busHandler = vi.fn();
    const unsubscribe = subscribeUserSettings(busHandler);

    try {
      render(
        <SettingsForm
          user={baseUser}
          createdAt="2024-03-15T00:00:00Z"
          providers={["google"]}
          initialSettings={makeUserSettings()}
        />
      );

      await screen.findByRole("switch", { name: /show completed tasks/i });

      const darkRadio = screen.getByLabelText(/^dark$/i);
      await user.click(darkRadio);

      await waitFor(() => {
        expect(busHandler).toHaveBeenCalledWith({ theme: "dark" });
      });

      // Settle any trailing microtasks so a hypothetical loop would
      // have time to fire a second emit.
      await act(async () => {
        await Promise.resolve();
      });

      // Exactly one user-settings PUT (the theme change). The
      // profile-settings GET on mount is `/api/profiles/...`, not
      // `/api/settings`, so it is excluded by the URL filter.
      const userSettingsPuts = fetchMock.mock.calls.filter((call) => {
        const [url, init] = call;
        return url === "/api/settings" && init?.method === "PUT";
      });
      expect(userSettingsPuts).toHaveLength(1);

      // Exactly one external bus delivery. If the form's own
      // subscription re-emitted on receipt, this would be > 1.
      expect(busHandler).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});
