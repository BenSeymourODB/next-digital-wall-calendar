/**
 * Tests for SideNavigation component
 *
 * Verifies that nav items render, the active route is highlighted, and
 * clicking a nav item routes via next/navigation.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SideNavigation } from "../side-navigation";

const pushMock = vi.fn();
let mockPathname = "/calendar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

beforeEach(() => {
  pushMock.mockClear();
  mockPathname = "/calendar";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SideNavigation", () => {
  it("renders a landmark nav with a button for each main screen", () => {
    render(<SideNavigation />);

    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /calendar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /recipe/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profiles/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("marks the active route with aria-current='page'", () => {
    mockPathname = "/calendar";
    render(<SideNavigation />);

    const active = screen.getByRole("link", { name: /calendar/i });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("only marks one link as active at a time", () => {
    mockPathname = "/recipe";
    render(<SideNavigation />);

    const current = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(/recipe/i);
  });

  it("calls router.push when a non-active item is clicked", async () => {
    mockPathname = "/calendar";
    const user = userEvent.setup();
    render(<SideNavigation />);

    await user.click(screen.getByRole("link", { name: /recipe/i }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/recipe");
  });

  it("does not push when the active item is clicked", async () => {
    mockPathname = "/calendar";
    const user = userEvent.setup();
    render(<SideNavigation />);

    await user.click(screen.getByRole("link", { name: /calendar/i }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("highlights the parent nav item for nested routes", () => {
    mockPathname = "/profiles/new";
    render(<SideNavigation />);

    const active = screen.getByRole("link", { name: /profiles/i });
    expect(active).toHaveAttribute("aria-current", "page");
  });
});
