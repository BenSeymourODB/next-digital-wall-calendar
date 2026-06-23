import { DEFAULT_USER_CALENDAR_SETTINGS } from "@/hooks/use-user-settings";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecipePage from "../page";

const mockUseUserSettings = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-user-settings", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/use-user-settings")
  >("@/hooks/use-user-settings");
  return {
    ...actual,
    useUserSettings: mockUseUserSettings,
  };
});

const mockUseSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

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

type Status = "loading" | "authenticated" | "unauthenticated";

function setEnv({
  defaultZoomLevel = 1.0,
  hasLoadedFromServer = true,
  status = "authenticated",
}: {
  defaultZoomLevel?: number;
  hasLoadedFromServer?: boolean;
  status?: Status;
} = {}) {
  mockUseSession.mockReturnValue({ data: null, status });
  mockUseUserSettings.mockReturnValue({
    settings: {
      ...DEFAULT_USER_CALENDAR_SETTINGS,
      defaultZoomLevel,
    },
    isLoading: false,
    hasLoadedFromServer,
  });
}

describe("RecipePage", () => {
  beforeEach(() => {
    recipeDisplaySpy.mockClear();
    mockUseUserSettings.mockReset();
    mockUseSession.mockReset();
  });

  it("defers RecipeDisplay until the authenticated user's settings load", () => {
    // Reproduces the first-render race: status flips to "authenticated"
    // synchronously but the GET hasn't resolved yet, so hasLoadedFromServer
    // is still false. Mounting RecipeDisplay here would lock in the default
    // zoom (via `useZoom`'s lazy initializer) before the real value arrives.
    setEnv({
      defaultZoomLevel: 1.5,
      hasLoadedFromServer: false,
      status: "authenticated",
    });

    const { queryByTestId } = render(<RecipePage />);

    expect(queryByTestId("recipe-display-mock")).toBeNull();
    expect(recipeDisplaySpy).not.toHaveBeenCalled();
  });

  it("defers RecipeDisplay while NextAuth's session status is still resolving", () => {
    // status === "loading" can resolve to either "authenticated" or
    // "unauthenticated"; deferring during the transient state avoids a
    // flash if the user turns out to be authenticated with a non-default
    // zoom.
    setEnv({ hasLoadedFromServer: false, status: "loading" });

    const { queryByTestId } = render(<RecipePage />);

    expect(queryByTestId("recipe-display-mock")).toBeNull();
    expect(recipeDisplaySpy).not.toHaveBeenCalled();
  });

  it("forwards UserSettings.defaultZoomLevel as RecipeDisplay initialZoom", () => {
    setEnv({
      defaultZoomLevel: 1.5,
      hasLoadedFromServer: true,
      status: "authenticated",
    });

    const { getByTestId } = render(<RecipePage />);

    expect(getByTestId("recipe-display-mock")).toBeInTheDocument();
    expect(recipeDisplaySpy).toHaveBeenCalledTimes(1);
    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(1.5);
  });

  it("clamps a defaultZoomLevel below the slider minimum to 0.5", () => {
    setEnv({
      defaultZoomLevel: 0.1,
      hasLoadedFromServer: true,
      status: "authenticated",
    });

    render(<RecipePage />);

    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(0.5);
  });

  it("clamps a defaultZoomLevel above the slider maximum to 2.0", () => {
    setEnv({
      defaultZoomLevel: 5,
      hasLoadedFromServer: true,
      status: "authenticated",
    });

    render(<RecipePage />);

    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(2.0);
  });

  it("falls back to 1.0 when defaultZoomLevel is not finite", () => {
    setEnv({
      defaultZoomLevel: Number.NaN,
      hasLoadedFromServer: true,
      status: "authenticated",
    });

    render(<RecipePage />);

    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(1.0);
  });

  it("renders RecipeDisplay at default zoom for unauthenticated users without waiting for a load", () => {
    // Unauthenticated path: no GET is in flight and none ever will be, so
    // hasLoadedFromServer stays false. The page must mount immediately
    // using the in-memory default rather than block on a never-arriving
    // settings response.
    setEnv({
      defaultZoomLevel: 1.0,
      hasLoadedFromServer: false,
      status: "unauthenticated",
    });

    const { getByTestId } = render(<RecipePage />);

    expect(getByTestId("recipe-display-mock")).toBeInTheDocument();
    expect(recipeDisplaySpy).toHaveBeenCalledTimes(1);
    expect(recipeDisplaySpy.mock.calls[0][0].initialZoom).toBe(1.0);
  });
});
