/**
 * Focused tests for the `workingHoursStart` clamp inside `CalendarProvider`.
 *
 * The full `CalendarProvider.test.tsx` covers the provider's other surface
 * area; this file mocks `useUserSettings` directly so it can feed in
 * out-of-range / fractional values that the live hook would already reject
 * (issue #288). The clamp protects against a malformed cache or a
 * non-conforming third-party DB write that bypasses the API validator.
 */
import {
  CalendarProvider,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import {
  DEFAULT_USER_CALENDAR_SETTINGS,
  type UserCalendarSettings,
} from "@/hooks/use-user-settings";
import { SessionProvider } from "next-auth/react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseUserSettings = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-user-settings", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/use-user-settings")
  >("@/hooks/use-user-settings");
  return { ...actual, useUserSettings: mockUseUserSettings };
});

vi.mock("next-auth/react", async () => {
  const actual =
    await vi.importActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    useSession: () => ({ data: null, status: "unauthenticated" }),
  };
});

vi.mock("@/lib/calendar-storage", () => ({
  loadColorMappings: () => [],
  saveColorMappings: vi.fn(),
  loadSettings: () => ({ refreshInterval: 60 }),
  eventCache: {
    getEvents: vi.fn().mockResolvedValue([]),
    saveEvents: vi.fn().mockResolvedValue(undefined),
  },
}));

function WorkingHoursProbe() {
  const { workingHoursStart } = useCalendar();
  return <span data-testid="working-hours">{String(workingHoursStart)}</span>;
}

function renderWith(settingsOverride: Partial<UserCalendarSettings>) {
  mockUseUserSettings.mockReturnValue({
    settings: { ...DEFAULT_USER_CALENDAR_SETTINGS, ...settingsOverride },
    isLoading: false,
  });
  return render(
    <SessionProvider session={null}>
      <CalendarProvider>
        <WorkingHoursProbe />
      </CalendarProvider>
    </SessionProvider>
  );
}

describe("CalendarProvider — workingHoursStart clamp (#288)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseUserSettings.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes through valid in-range values unchanged", async () => {
    renderWith({ calendarWorkingHoursStart: 5 });
    await waitFor(() => {
      expect(screen.getByTestId("working-hours")).toHaveTextContent("5");
    });
  });

  it.each([
    ["negative", -1, 0],
    ["below floor (large negative)", -100, 0],
    ["above ceiling", 24, 23],
    ["far above ceiling", 9999, 23],
  ])(
    "clamps out-of-range %s value (%s) to %s",
    async (_label, input, expected) => {
      renderWith({ calendarWorkingHoursStart: input });
      await waitFor(() => {
        expect(screen.getByTestId("working-hours")).toHaveTextContent(
          String(expected)
        );
      });
    }
  );

  it("truncates fractional values toward zero", async () => {
    renderWith({ calendarWorkingHoursStart: 7.9 });
    await waitFor(() => {
      expect(screen.getByTestId("working-hours")).toHaveTextContent("7");
    });
  });

  it("accepts the 0 and 23 boundaries verbatim", async () => {
    const { unmount } = renderWith({ calendarWorkingHoursStart: 0 });
    await waitFor(() => {
      expect(screen.getByTestId("working-hours")).toHaveTextContent("0");
    });
    unmount();

    renderWith({ calendarWorkingHoursStart: 23 });
    await waitFor(() => {
      expect(screen.getByTestId("working-hours")).toHaveTextContent("23");
    });
  });
});
