/**
 * Tests for the ThemeScope primitive (issue #319).
 *
 * The component wraps a subtree in `[data-theme-scope="light" | "dark"]`,
 * which a CSS rule in globals.css uses to re-declare all shadcn/ui semantic
 * token variables to the opposite scheme. jsdom does not parse Tailwind's
 * preflight or `globals.css` automatically, so colour-resolution behaviour
 * is asserted via a dedicated `<style>` injection in these tests; the
 * production pages rely on the rules in `globals.css`.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeScope } from "../theme-scope";

describe("ThemeScope", () => {
  it("renders children inside a wrapper with the data-theme-scope attribute", () => {
    const { getByTestId } = render(
      <ThemeScope mode="light">
        <span data-testid="scope-child">child</span>
      </ThemeScope>
    );

    const child = getByTestId("scope-child");
    const wrapper = child.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("data-theme-scope")).toBe("light");
  });

  it("supports a dark scope", () => {
    const { getByTestId } = render(
      <ThemeScope mode="dark">
        <span data-testid="scope-child">child</span>
      </ThemeScope>
    );

    expect(
      getByTestId("scope-child").parentElement?.getAttribute("data-theme-scope")
    ).toBe("dark");
  });

  it("forwards an optional className for layout", () => {
    const { getByTestId } = render(
      <ThemeScope mode="light" className="h-full w-full">
        <span data-testid="scope-child">child</span>
      </ThemeScope>
    );

    const wrapper = getByTestId("scope-child").parentElement;
    expect(wrapper?.className).toContain("h-full");
    expect(wrapper?.className).toContain("w-full");
  });

  it("supports nesting — innermost scope wins on the immediate descendant", () => {
    const { getByTestId } = render(
      <ThemeScope mode="dark">
        <ThemeScope mode="light">
          <span data-testid="inner-child">inner</span>
        </ThemeScope>
      </ThemeScope>
    );

    const inner = getByTestId("inner-child").parentElement;
    expect(inner?.getAttribute("data-theme-scope")).toBe("light");

    const outer = inner?.parentElement;
    expect(outer?.getAttribute("data-theme-scope")).toBe("dark");
  });

  it("re-declares the --background token differently per scope", () => {
    // Inject scope vars locally — production picks these up from globals.css.
    // jsdom does not resolve `var(...)` references in computed `background-color`,
    // so we read the custom property directly via getPropertyValue, which jsdom
    // does report from matched rules.
    //
    // NB: this test is an approximation of the real behaviour — it locks in
    // that the data-theme-scope selectors land at all. The full visual
    // contract (Tailwind `bg-background`, `text-foreground`, SVG fills via
    // `var(--card)`, etc. all flipping under the scope) is verified in the
    // Playwright/visual layer, since jsdom's `getComputedStyle` support for
    // custom-property cascades has historically varied between versions.
    const style = document.createElement("style");
    style.textContent = `
      [data-theme-scope="light"] { --background: rgb(255, 255, 255); }
      [data-theme-scope="dark"]  { --background: rgb(20, 20, 20); }
    `;
    document.head.appendChild(style);

    try {
      const { getByTestId } = render(
        <div>
          <ThemeScope mode="dark">
            <div data-testid="dark-probe" />
          </ThemeScope>
          <ThemeScope mode="light">
            <div data-testid="light-probe" />
          </ThemeScope>
        </div>
      );

      const darkVar = getComputedStyle(
        getByTestId("dark-probe").parentElement as Element
      )
        .getPropertyValue("--background")
        .trim();
      const lightVar = getComputedStyle(
        getByTestId("light-probe").parentElement as Element
      )
        .getPropertyValue("--background")
        .trim();

      expect(darkVar).toBe("rgb(20, 20, 20)");
      expect(lightVar).toBe("rgb(255, 255, 255)");
    } finally {
      style.remove();
    }
  });
});
