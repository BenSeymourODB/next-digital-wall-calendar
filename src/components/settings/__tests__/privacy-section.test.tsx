/**
 * Tests for PrivacySection component
 * Following TDD - tests are written before implementation
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySection } from "../privacy-section";

// Mock sonner toast
const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => mockToast(...args),
  },
}));

describe("PrivacySection", () => {
  const mockOnDeleteAllData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDeleteAllData.mockResolvedValue(undefined);
  });

  it("shows connected permissions", () => {
    render(
      <PrivacySection
        permissions={["Google Calendar (read)", "Google Tasks (read/write)"]}
        onDeleteAllData={mockOnDeleteAllData}
      />
    );

    expect(screen.getByText(/google calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/google tasks/i)).toBeInTheDocument();
  });

  it("shows export data button", () => {
    render(
      <PrivacySection permissions={[]} onDeleteAllData={mockOnDeleteAllData} />
    );

    expect(
      screen.getByRole("button", { name: /export data/i })
    ).toBeInTheDocument();
  });

  it("shows delete all data button", () => {
    render(
      <PrivacySection permissions={[]} onDeleteAllData={mockOnDeleteAllData} />
    );

    expect(
      screen.getByRole("button", { name: /delete all data/i })
    ).toBeInTheDocument();
  });

  it("export data button shows coming soon toast", async () => {
    const user = userEvent.setup();

    render(
      <PrivacySection permissions={[]} onDeleteAllData={mockOnDeleteAllData} />
    );

    const exportButton = screen.getByRole("button", {
      name: /export data/i,
    });
    await user.click(exportButton);

    expect(mockToast).toHaveBeenCalledWith("Coming soon");
  });

  it("delete all data shows confirmation dialog", async () => {
    const user = userEvent.setup();

    render(
      <PrivacySection permissions={[]} onDeleteAllData={mockOnDeleteAllData} />
    );

    const deleteButton = screen.getByRole("button", {
      name: /delete all data/i,
    });
    await user.click(deleteButton);

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });
});
