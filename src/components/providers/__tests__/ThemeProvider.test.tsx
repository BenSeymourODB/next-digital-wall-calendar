/**
 * Tests for ThemeProvider component
 * TDD: Tests written before implementation
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// Import after mock
import { ThemeProvider } from "../ThemeProvider";

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
    themes?: string[];
  }) => (
    <div
      data-testid="next-themes-provider"
      data-attribute={props.attribute}
      data-default-theme={props.defaultTheme}
      data-enable-system={String(props.enableSystem)}
      data-disable-transition={String(props.disableTransitionOnChange)}
      data-themes={props.themes ? props.themes.join(",") : ""}
    >
      {children}
    </div>
  ),
}));

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("uses class attribute for theme switching", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId("next-themes-provider");
    expect(provider).toHaveAttribute("data-attribute", "class");
  });

  it("defaults to system theme", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId("next-themes-provider");
    expect(provider).toHaveAttribute("data-default-theme", "system");
  });

  it("enables system theme detection", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId("next-themes-provider");
    expect(provider).toHaveAttribute("data-enable-system", "true");
  });

  it("disables CSS transitions on theme change to prevent flash", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId("next-themes-provider");
    expect(provider).toHaveAttribute("data-disable-transition", "true");
  });

  it("registers wall-projector as a custom theme alongside light and dark", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId("next-themes-provider");
    const themes = (provider.getAttribute("data-themes") ?? "").split(",");
    expect(themes).toContain("light");
    expect(themes).toContain("dark");
    expect(themes).toContain("wall-projector");
  });
});
