/**
 * Tests for /test/tasks page — live-mode list-picker localStorage persistence (#289)
 *
 * The page always renders a live-mode section with a <select> that lets the
 * tester pick which Google Tasks list to display. The selection is persisted
 * to localStorage under the key "test-tasks.live-list" so it survives reloads.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
// ---- component import (after mocks) -------------------------------------- //
import TestTasksPage from "../page";

// ---- localStorage stub --------------------------------------------------- //
const mockStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
});

// ---- next/navigation stub ------------------------------------------------ //
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// ---- fetch stub ---------------------------------------------------------- //
const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_LISTS = [
  { id: "list-1", title: "Groceries", updated: "2024-01-01T00:00:00Z" },
  { id: "list-2", title: "Work", updated: "2024-01-01T00:00:00Z" },
];

function makeFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

// -------------------------------------------------------------------------- //

const LS_KEY = "test-tasks.live-list";

describe("/test/tasks page — live-mode list picker", () => {
  beforeEach(() => {
    // Clear storage and mock state between tests
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    mockFetch.mockReset();
    mockFetch.mockReturnValue(makeFetchResponse({ lists: MOCK_LISTS }));
  });

  it("renders a list picker select element", async () => {
    render(<TestTasksPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /live list/i })
      ).toBeInTheDocument();
    });
  });

  it("populates the picker with fetched lists", async () => {
    render(<TestTasksPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Groceries" })
      ).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Work" })).toBeInTheDocument();
    });
  });

  it("persists selection to localStorage when user changes the picker", async () => {
    const user = userEvent.setup();
    render(<TestTasksPage />);

    const select = await screen.findByRole("combobox", { name: /live list/i });
    await user.selectOptions(select, "list-2");

    expect(mockStorage[LS_KEY]).toBe(JSON.stringify("list-2"));
  });

  it("restores a previously saved selection on remount", async () => {
    // Pre-seed storage with a saved list id
    mockStorage[LS_KEY] = JSON.stringify("list-2");

    render(<TestTasksPage />);

    const select = await screen.findByRole("combobox", { name: /live list/i });
    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe("list-2");
    });
  });

  it("falls back to default when persisted id is not in the fetched lists (stale)", async () => {
    // Persisted id references a list that no longer exists
    mockStorage[LS_KEY] = JSON.stringify("list-stale-deleted");

    render(<TestTasksPage />);

    const select = await screen.findByRole("combobox", { name: /live list/i });
    await waitFor(() => {
      // Should not throw; value should fall back to an empty/default selection
      expect((select as HTMLSelectElement).value).not.toBe(
        "list-stale-deleted"
      );
    });
  });
});
