import { type TCalendarAccessRole, narrowAccessRole } from "@/types/calendar";
import { describe, expect, it } from "vitest";

describe("narrowAccessRole", () => {
  it.each<TCalendarAccessRole>(["freeBusyReader", "reader", "writer", "owner"])(
    "passes through %s unchanged",
    (role) => {
      expect(narrowAccessRole(role)).toBe(role);
    }
  );

  it("falls back to 'reader' when value is undefined", () => {
    expect(narrowAccessRole(undefined)).toBe("reader");
  });

  it("falls back to 'reader' for unknown role strings", () => {
    // Future Google additions arrive as unrecognised strings; the route
    // (#277) keeps the Zod schema permissive (`z.string()`) and relies on
    // this narrow to fail closed to the safest role.
    expect(narrowAccessRole("admin")).toBe("reader");
    expect(narrowAccessRole("super-owner")).toBe("reader");
    expect(narrowAccessRole("")).toBe("reader");
  });

  it("does not narrow case-variant strings (Google sends camelCase)", () => {
    // Defensive: a typo'd Google response (`Owner`, `OWNER`) should not be
    // promoted to write access. The canonical values are camelCase.
    expect(narrowAccessRole("Owner")).toBe("reader");
    expect(narrowAccessRole("OWNER")).toBe("reader");
    expect(narrowAccessRole("Writer")).toBe("reader");
  });
});
