import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClockBox } from "../clamp-label";
import { FloatingLabel, type FloatingLabelProps } from "../floating-label";

const baseProps: FloatingLabelProps = {
  id: "evt-1",
  text: "the quick brown fox jumps",
  anchorAngle: 45, // top-right quadrant (0° = 12 o'clock, clockwise)
  anchorRadius: 240,
  labelRadius: 270,
  color: "#22C55E",
  cx: 250,
  cy: 250,
  clockBox: { top: 50, bottom: 450, height: 400 } satisfies ClockBox,
};

function renderLabel(overrides: Partial<FloatingLabelProps> = {}) {
  return render(
    <svg viewBox="0 0 500 500">
      <FloatingLabel {...baseProps} {...overrides} />
    </svg>
  );
}

function num(el: Element, attr: string): number {
  const v = el.getAttribute(attr);
  if (v === null) throw new Error(`missing attribute ${attr}`);
  return Number.parseFloat(v);
}

describe("FloatingLabel", () => {
  it("renders the connector line, background rect, and label text", () => {
    renderLabel();
    expect(screen.getByTestId("floating-label-evt-1")).toBeInTheDocument();
    expect(
      screen.getByTestId("floating-label-connector-evt-1")
    ).toBeInTheDocument();
    expect(screen.getByTestId("floating-label-rect-evt-1")).toBeInTheDocument();
    const text = screen.getByTestId("floating-label-text-evt-1");
    expect(text).toBeInTheDocument();
    expect(text.textContent).toBe(baseProps.text);
  });

  it("uses the event color for the connector stroke at low opacity", () => {
    renderLabel();
    const connector = screen.getByTestId("floating-label-connector-evt-1");
    expect(connector.getAttribute("stroke")).toBe(baseProps.color);
    const opacity = Number.parseFloat(
      connector.getAttribute("stroke-opacity") ?? "1"
    );
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  it("anchors the connector start at the arc midpoint outer radius", () => {
    // anchor at angle=45, radius=240, center=(250,250)
    // x = 250 + 240*cos((45-90)*PI/180) = 250 + 240*cos(-45°) ≈ 419.71
    // y = 250 + 240*sin(-45°) ≈ 80.29
    renderLabel();
    const connector = screen.getByTestId("floating-label-connector-evt-1");
    const x1 = num(connector, "x1");
    const y1 = num(connector, "y1");
    expect(x1).toBeCloseTo(419.7, 0);
    expect(y1).toBeCloseTo(80.3, 0);
  });

  it("places the rect centered on the (clamped) label position on the outer circle", () => {
    renderLabel();
    const rect = screen.getByTestId("floating-label-rect-evt-1");
    const x = num(rect, "x");
    const y = num(rect, "y");
    const w = num(rect, "width");
    const h = num(rect, "height");
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    // ideal label center at angle=45, labelRadius=270 → (440.92, 59.08)
    // clockBox top=50, height=400 → upper limit = 50 - 40 = 10
    // Since 59.08 > 10, no clamp; centerY ≈ 59.08
    expect(centerX).toBeCloseTo(440.9, 0);
    expect(centerY).toBeCloseTo(59.1, 0);
  });

  it("clamps the label vertical position when ideal position would exceed the top band", () => {
    // anchorAngle=0 (12 o'clock), labelRadius=270 → ideal label center y = cy-270 = -20
    // clockBox top=50, height=400 → upper limit = 50 - 40 = 10. So clamp to y=10.
    renderLabel({ anchorAngle: 0 });
    const rect = screen.getByTestId("floating-label-rect-evt-1");
    const y = num(rect, "y");
    const h = num(rect, "height");
    expect(y + h / 2).toBeCloseTo(10, 1);
  });

  it("clamps the label vertical position when ideal position would exceed the bottom band", () => {
    // anchorAngle=180 (6 o'clock), labelRadius=270 → ideal label center y = cy+270 = 520
    // clockBox bottom=450, height=400 → lower limit = 450 + 40 = 490. So clamp to y=490.
    renderLabel({ anchorAngle: 180 });
    const rect = screen.getByTestId("floating-label-rect-evt-1");
    const y = num(rect, "y");
    const h = num(rect, "height");
    expect(y + h / 2).toBeCloseTo(490, 1);
  });

  /**
   * For each quadrant, assert that the connector's far endpoint sits on the
   * rect's boundary (not inside, not outside) and on the side of the rect
   * facing the anchor — i.e. between the rect centre and the anchor along
   * each axis. This is the geometric invariant the spec actually cares about,
   * agnostic to whether a wide-but-flat label exits through a side or top/
   * bottom edge.
   */
  function assertConnectorEndsOnRectBoundaryFacingAnchor(): void {
    const connector = screen.getByTestId("floating-label-connector-evt-1");
    const rect = screen.getByTestId("floating-label-rect-evt-1");
    const x1 = num(connector, "x1");
    const y1 = num(connector, "y1");
    const x2 = num(connector, "x2");
    const y2 = num(connector, "y2");
    const rx = num(rect, "x");
    const ry = num(rect, "y");
    const rw = num(rect, "width");
    const rh = num(rect, "height");
    const cxRect = rx + rw / 2;
    const cyRect = ry + rh / 2;

    // Endpoint is inside the rect (inclusive) — not floating in the air past it.
    expect(x2).toBeGreaterThanOrEqual(rx - 0.01);
    expect(x2).toBeLessThanOrEqual(rx + rw + 0.01);
    expect(y2).toBeGreaterThanOrEqual(ry - 0.01);
    expect(y2).toBeLessThanOrEqual(ry + rh + 0.01);

    // Endpoint sits on the rect boundary — at least one coordinate hits an edge.
    const onLeft = Math.abs(x2 - rx) < 0.5;
    const onRight = Math.abs(x2 - (rx + rw)) < 0.5;
    const onTop = Math.abs(y2 - ry) < 0.5;
    const onBottom = Math.abs(y2 - (ry + rh)) < 0.5;
    expect(onLeft || onRight || onTop || onBottom).toBe(true);

    // Endpoint is between the rect centre and the anchor — i.e. the connector
    // exits on the side facing the anchor, not the far side.
    if (Math.abs(x1 - cxRect) > 0.5) {
      expect(Math.sign(x2 - cxRect)).toBe(Math.sign(x1 - cxRect));
    }
    if (Math.abs(y1 - cyRect) > 0.5) {
      expect(Math.sign(y2 - cyRect)).toBe(Math.sign(y1 - cyRect));
    }
  }

  it("connector terminates on the rect boundary facing the anchor — top-right quadrant", () => {
    renderLabel({ anchorAngle: 45 });
    assertConnectorEndsOnRectBoundaryFacingAnchor();
  });

  it("connector terminates on the rect boundary facing the anchor — top-left quadrant", () => {
    renderLabel({ anchorAngle: 315 });
    assertConnectorEndsOnRectBoundaryFacingAnchor();
  });

  it("connector terminates on the rect boundary facing the anchor — bottom-right quadrant", () => {
    renderLabel({ anchorAngle: 135 });
    assertConnectorEndsOnRectBoundaryFacingAnchor();
  });

  it("connector terminates on the rect boundary facing the anchor — bottom-left quadrant", () => {
    renderLabel({ anchorAngle: 225 });
    assertConnectorEndsOnRectBoundaryFacingAnchor();
  });

  it("uses the event color for the rect border at low opacity, with a non-coloured fill", () => {
    renderLabel();
    const rect = screen.getByTestId("floating-label-rect-evt-1");
    expect(rect.getAttribute("stroke")).toBe(baseProps.color);
    expect(rect.getAttribute("fill")).not.toBe(baseProps.color);
  });

  it("renders as a non-interactive group when no onClick is provided", () => {
    renderLabel();
    const group = screen.getByTestId("floating-label-evt-1");
    expect(group.getAttribute("role")).not.toBe("button");
    expect(group.getAttribute("tabindex")).toBeNull();
  });

  describe("when onClick is provided", () => {
    it("renders as role='button' with tabIndex=0", () => {
      const onClick = vi.fn();
      renderLabel({ onClick });
      const group = screen.getByTestId("floating-label-evt-1");
      expect(group.getAttribute("role")).toBe("button");
      expect(group.getAttribute("tabindex")).toBe("0");
    });

    it("invokes onClick with the event id and the <g> element on click", () => {
      const onClick = vi.fn();
      renderLabel({ onClick });
      const group = screen.getByTestId("floating-label-evt-1");
      fireEvent.click(group);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith("evt-1", group);
    });

    it("invokes onClick on Enter and Space keypresses", () => {
      const onClick = vi.fn();
      renderLabel({ onClick });
      const group = screen.getByTestId("floating-label-evt-1");
      fireEvent.keyDown(group, { key: "Enter" });
      fireEvent.keyDown(group, { key: " " });
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it("does not invoke onClick on other keys", () => {
      const onClick = vi.fn();
      renderLabel({ onClick });
      const group = screen.getByTestId("floating-label-evt-1");
      fireEvent.keyDown(group, { key: "Tab" });
      fireEvent.keyDown(group, { key: "Escape" });
      expect(onClick).not.toHaveBeenCalled();
    });

    it("exposes an aria-label that includes the label text", () => {
      const onClick = vi.fn();
      renderLabel({ onClick });
      const group = screen.getByTestId("floating-label-evt-1");
      expect(group.getAttribute("aria-label")).toContain(baseProps.text);
    });
  });
});
