/**
 * Tests for ThemeToggle component
 * TDD: Tests written before implementation
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../theme-toggle";

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockTheme === "system" ? "light" : mockTheme,
  }),
}));

// Mock Radix dropdown since it doesn't work in jsdom
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-as-child={asChild}>{children}</div>,
  DropdownMenuContent: ({
    children,
    align,
  }: {
    children: React.ReactNode;
    align?: string;
  }) => (
    <div data-testid="theme-menu-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = "system";
  });

  it("renders a toggle button", () => {
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
  });

  it("shows sun and moon icons for visual indication", () => {
    render(<ThemeToggle />);

    // The button should contain SVG icons (sun and moon)
    const button = screen.getByRole("button", { name: /toggle theme/i });
    const svgs = button.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders three theme options: Light, Dark, System", () => {
    render(<ThemeToggle />);

    const menuItems = screen.getAllByRole("menuitem");
    const texts = menuItems.map((item) => item.textContent);

    expect(texts).toContain("Light");
    expect(texts).toContain("Dark");
    expect(texts).toContain("System");
  });

  it("calls setTheme('light') when Light option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const lightOption = screen.getByRole("menuitem", { name: /light/i });
    await user.click(lightOption);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme('dark') when Dark option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const darkOption = screen.getByRole("menuitem", { name: /dark/i });
    await user.click(darkOption);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme('system') when System option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const systemOption = screen.getByRole("menuitem", { name: /system/i });
    await user.click(systemOption);

    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("accepts optional className prop for positioning", () => {
    render(<ThemeToggle className="absolute top-4 right-4" />);

    // The component should be renderable with custom positioning
    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
  });

  it("has accessible screen reader text", () => {
    render(<ThemeToggle />);

    expect(screen.getByText("Toggle theme")).toBeInTheDocument();
  });
});
