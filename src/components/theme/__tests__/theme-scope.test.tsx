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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ThemeScope } from "../theme-scope";

const GLOBALS_CSS_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "app",
  "globals.css"
);

/**
 * Read the `@custom-variant dark (...)` selector from globals.css and turn it
 * into a CSS rule that flags matched elements with `--dark-variant-active: 1`.
 * The test then asserts presence/absence of that flag in cross-scope scenarios.
 * Pulling the selector from the source-of-truth file (not duplicating it in
 * the test) is what gives this a real red→green cycle when globals.css
 * changes.
 */
function darkVariantProbeRule(): string {
  const css = readFileSync(GLOBALS_CSS_PATH, "utf8");
  // Directive form: `@custom-variant dark (<balanced-parens-selector>);`.
  // Find the opening `(` then walk paren-balanced to the matching `)`.
  const start = css.search(/@custom-variant\s+dark\s+\(/);
  if (start === -1) {
    throw new Error("Could not locate @custom-variant dark in globals.css");
  }
  const open = css.indexOf("(", start);
  let depth = 1;
  let end = -1;
  for (let i = open + 1; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error("Unbalanced @custom-variant dark selector in globals.css");
  }
  // The selector uses `&` for the variant target. Replace with `*` so the rule
  // applies to any matching element.
  const selector = css
    .slice(open + 1, end)
    .trim()
    .replaceAll("&", "*");
  return `${selector} { --dark-variant-active: 1; }`;
}

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

  describe("dark variant tightening (#324)", () => {
    // The probe sets `--dark-variant-active: 1` directly on matched elements,
    // so `getComputedStyle().getPropertyValue()` here is a direct match (not
    // a cascade lookup) — that path is reliable in jsdom even where its
    // `var(...)` resolution historically isn't.
    //
    // The `activates …` cases (toBe(true)) double as a parser smoke-test:
    // if jsdom ever drops the `:not(:where(...))` rule entirely as unparseable,
    // those would fail too, so the `suppresses …` cases (toBe(false)) cannot
    // pass vacuously.
    function withProbeStylesheet<T>(run: () => T): T {
      const style = document.createElement("style");
      style.textContent = darkVariantProbeRule();
      document.head.appendChild(style);
      try {
        return run();
      } finally {
        style.remove();
      }
    }

    function probeActive(el: Element): boolean {
      return (
        getComputedStyle(el)
          .getPropertyValue("--dark-variant-active")
          .trim() === "1"
      );
    }

    it("activates dark variant under .dark with no scope", () => {
      withProbeStylesheet(() => {
        const { getByTestId } = render(
          <div className="dark">
            <span data-testid="probe">x</span>
          </div>
        );
        expect(probeActive(getByTestId("probe"))).toBe(true);
      });
    });

    it("suppresses dark variant under .dark inside a light scope", () => {
      withProbeStylesheet(() => {
        const { getByTestId } = render(
          <div className="dark">
            <ThemeScope mode="light">
              <span data-testid="probe">x</span>
            </ThemeScope>
          </div>
        );
        expect(probeActive(getByTestId("probe"))).toBe(false);
      });
    });

    it("activates dark variant inside a dark scope under a light outer theme", () => {
      withProbeStylesheet(() => {
        const { getByTestId } = render(
          <div>
            <ThemeScope mode="dark">
              <span data-testid="probe">x</span>
            </ThemeScope>
          </div>
        );
        expect(probeActive(getByTestId("probe"))).toBe(true);
      });
    });

    it("suppresses dark variant under .wall-projector inside a light scope", () => {
      withProbeStylesheet(() => {
        const { getByTestId } = render(
          <div className="wall-projector">
            <ThemeScope mode="light">
              <span data-testid="probe">x</span>
            </ThemeScope>
          </div>
        );
        expect(probeActive(getByTestId("probe"))).toBe(false);
      });
    });

    it("activates dark variant on the dark scope element itself", () => {
      withProbeStylesheet(() => {
        const { getByTestId } = render(
          <ThemeScope mode="dark">
            <span data-testid="probe">x</span>
          </ThemeScope>
        );
        // The wrapper IS [data-theme-scope="dark"]; the child is a descendant.
        const probe = getByTestId("probe");
        expect(probeActive(probe)).toBe(true);
        expect(probeActive(probe.parentElement as Element)).toBe(true);
      });
    });

    it("activates dark variant on the .dark element itself (self-match)", () => {
      // Symmetric with the [data-theme-scope="dark"] self-match above — the
      // element carrying the dark class matches the positive arm directly.
      withProbeStylesheet(() => {
        const { getByTestId } = render(
          <div className="dark" data-testid="dark-root">
            <span>x</span>
          </div>
        );
        expect(probeActive(getByTestId("dark-root"))).toBe(true);
      });
    });
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
