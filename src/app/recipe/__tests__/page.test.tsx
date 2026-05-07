import { DEFAULT_USER_CALENDAR_SETTINGS } from "@/hooks/useUserSettings";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecipePage from "../page";

const mockUseUserSettings = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useUserSettings", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/useUserSettings")
  >("@/hooks/useUserSettings");
  return {
    ...actual,
    useUserSettings: mockUseUserSettings,
  };
});

const recipeDisplaySpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/recipe", () => ({
  RecipeDisplay: (props: { initialZoom?: number }) => {
    recipeDisplaySpy(props);
    return <div data-testid="recipe-display-mock" />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function setSettings(defaultZoomLevel: number, isLoading = false) {
  mockUseUserSettings.mockReturnValue({
    settings: {
      calendarRefreshIntervalMinutes: 15,
      calendarFetchMonthsAhead: 6,
      calendarFetchMonthsBehind: 1,
      calendarMaxEventsPerDay: 3,
      defaultZoomLevel,
    },
    isLoading,
  });
}

describe("RecipePage", () => {
  beforeEach(() => {
    recipeDisplaySpy.mockClear();
    mockUseUserSettings.mockReset();
  });

  it("does not render RecipeDisplay until settings have loaded", () => {
    setSettings(1.5, true);

    const { queryByTestId } = render(<RecipePage />);

    expect(queryByTestId("recipe-display-mock")).toBeNull();
    expect(recipeDisplaySpy).not.toHaveBeenCalled();
  });

  it("forwards UserSettings.defaultZoomLevel as RecipeDisplay initialZoom", () => {
    setSettings(1.5);

    const { getByTestId } = render(<RecipePage />);

    expect(getByTestId("recipe-display-mock")).toBeInTheDocument();
    expect(recipeDisplaySpy).toHaveBeenCalledTimes(1);
    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(1.5);
  });

  it("clamps a defaultZoomLevel below the slider minimum to 0.5", () => {
    setSettings(0.1);

    render(<RecipePage />);

    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(0.5);
  });

  it("clamps a defaultZoomLevel above the slider maximum to 2.0", () => {
    setSettings(5);

    render(<RecipePage />);

    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(2.0);
  });

  it("falls back to 1.0 when defaultZoomLevel is not finite", () => {
    setSettings(Number.NaN);

    render(<RecipePage />);

    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(1.0);
  });

  it("renders RecipeDisplay at default zoom for unauthenticated users", () => {
    // Unauthenticated path: useUserSettings returns the default constant
    // (defaultZoomLevel = 1.0) with isLoading=false. This is the most common
    // production case for a guest visitor.
    mockUseUserSettings.mockReturnValue({
      settings: { ...DEFAULT_USER_CALENDAR_SETTINGS },
      isLoading: false,
    });

    const { getByTestId } = render(<RecipePage />);

    expect(getByTestId("recipe-display-mock")).toBeInTheDocument();
    expect(recipeDisplaySpy).toHaveBeenCalledTimes(1);
    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(1.0);
  });
});
