/**
 * Tests for TaskAssignmentPicker component
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileInfo } from "../task-assignment-picker";
import { TaskAssignmentPicker } from "../task-assignment-picker";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock profile data
const mockProfiles: ProfileInfo[] = [
  {
    id: "profile-1",
    name: "Dad",
    color: "#3b82f6",
    avatar: { type: "initials", value: "D" },
  },
  {
    id: "profile-2",
    name: "Mom",
    color: "#ef4444",
    avatar: { type: "initials", value: "M" },
  },
  {
    id: "profile-3",
    name: "Kid",
    color: "#22c55e",
    avatar: { type: "initials", value: "K" },
  },
];

describe("TaskAssignmentPicker", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders trigger button", () => {
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={[]}
          onChange={mockOnChange}
        />
      );

      expect(
        screen.getByRole("button", { name: /assign/i })
      ).toBeInTheDocument();
    });

    it("shows assigned profile avatars when profiles are assigned", () => {
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={["profile-1", "profile-2"]}
          onChange={mockOnChange}
        />
      );

      // Should show avatars for assigned profiles
      expect(screen.getByTitle("Dad")).toBeInTheDocument();
      expect(screen.getByTitle("Mom")).toBeInTheDocument();
    });

    it("shows 'Assign' text when no profiles are assigned", () => {
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={[]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText("Assign")).toBeInTheDocument();
    });
  });

  describe("dropdown interactions", () => {
    it("opens dropdown when trigger is clicked", async () => {
      const user = userEvent.setup();
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={[]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));

      // All profiles should be visible in dropdown
      expect(screen.getByText("Dad")).toBeInTheDocument();
      expect(screen.getByText("Mom")).toBeInTheDocument();
      expect(screen.getByText("Kid")).toBeInTheDocument();
    });

    it("shows checkboxes for each profile", async () => {
      const user = userEvent.setup();
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={["profile-1"]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
    });

    it("checks checkbox for assigned profiles", async () => {
      const user = userEvent.setup();
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={["profile-1"]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));

      const dadCheckbox = screen.getByRole("checkbox", { name: /dad/i });
      const momCheckbox = screen.getByRole("checkbox", { name: /mom/i });

      expect(dadCheckbox).toBeChecked();
      expect(momCheckbox).not.toBeChecked();
    });

    it("calls onChange when profile is toggled", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            assignments: [
              { profileId: "profile-1", profile: mockProfiles[0] },
              { profileId: "profile-2", profile: mockProfiles[1] },
            ],
          }),
      });

      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={["profile-1"]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));
      await user.click(screen.getByRole("checkbox", { name: /mom/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/tasks/task-123/assignments",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ profileIds: ["profile-1", "profile-2"] }),
          })
        );
      });
    });

    it("calls onChange when profile is unassigned", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ assignments: [] }),
      });

      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={["profile-1"]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));
      await user.click(screen.getByRole("checkbox", { name: /dad/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/tasks/task-123/assignments",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ profileIds: [] }),
          })
        );
      });
    });
  });

  describe("disabled state", () => {
    it("disables trigger when disabled prop is true", () => {
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={[]}
          onChange={mockOnChange}
          disabled
        />
      );

      expect(screen.getByRole("button", { name: /assign/i })).toBeDisabled();
    });
  });

  describe("API error handling", () => {
    it("shows error state when API fails", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={[]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));
      await user.click(screen.getByRole("checkbox", { name: /dad/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("has accessible labels", async () => {
      const user = userEvent.setup();
      render(
        <TaskAssignmentPicker
          taskId="task-123"
          profiles={mockProfiles}
          assignedProfileIds={[]}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole("button", { name: /assign/i }));

      // Each profile checkbox should have an accessible name
      expect(
        screen.getByRole("checkbox", { name: /dad/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: /mom/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: /kid/i })
      ).toBeInTheDocument();
    });
  });
});
