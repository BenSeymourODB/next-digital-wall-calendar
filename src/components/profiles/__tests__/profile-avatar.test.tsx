/**
 * Tests for ProfileAvatar component
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileAvatar } from "../profile-avatar";
import type { Profile } from "../profile-context";

// ProfileAvatar's prop type is the narrow subset { name, color, avatar }.
type ProfileAvatarFixture = Pick<Profile, "name" | "color" | "avatar">;

// Mock profile data
const mockProfile: ProfileAvatarFixture = {
  name: "Test User",
  color: "#3b82f6",
  avatar: {
    type: "initials",
    value: "TU",
    backgroundColor: "#3b82f6",
  },
};

describe("ProfileAvatar", () => {
  describe("initials avatar type", () => {
    it("renders initials correctly", () => {
      render(<ProfileAvatar profile={mockProfile} />);

      expect(screen.getByText("TU")).toBeInTheDocument();
    });

    it("applies background color from avatar", () => {
      const { container } = render(<ProfileAvatar profile={mockProfile} />);

      const avatarDiv = container.firstChild as HTMLElement;
      expect(avatarDiv).toHaveStyle({ backgroundColor: "#3b82f6" });
    });

    it("falls back to profile color if avatar backgroundColor not set", () => {
      const profileWithoutBgColor: ProfileAvatarFixture = {
        ...mockProfile,
        avatar: {
          type: "initials",
          value: "TU",
        },
      };

      const { container } = render(
        <ProfileAvatar profile={profileWithoutBgColor} />
      );

      const avatarDiv = container.firstChild as HTMLElement;
      expect(avatarDiv).toHaveStyle({ backgroundColor: "#3b82f6" });
    });
  });

  describe("emoji avatar type", () => {
    it("renders emoji correctly", () => {
      const emojiProfile: ProfileAvatarFixture = {
        ...mockProfile,
        avatar: {
          type: "emoji",
          value: "👦",
        },
      };

      render(<ProfileAvatar profile={emojiProfile} />);

      expect(screen.getByText("👦")).toBeInTheDocument();
    });
  });

  describe("photo avatar type", () => {
    it("renders image with correct src", () => {
      const photoProfile: ProfileAvatarFixture = {
        ...mockProfile,
        avatar: {
          type: "photo",
          value: "https://example.com/avatar.jpg",
        },
      };

      render(<ProfileAvatar profile={photoProfile} />);

      const img = screen.getByRole("img", { name: "Test User" });
      expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });
  });

  describe("size variants", () => {
    it("renders small size", () => {
      const { container } = render(
        <ProfileAvatar profile={mockProfile} size="sm" />
      );

      const avatarDiv = container.firstChild as HTMLElement;
      expect(avatarDiv.className).toContain("w-8");
      expect(avatarDiv.className).toContain("h-8");
    });

    it("renders medium size (default)", () => {
      const { container } = render(<ProfileAvatar profile={mockProfile} />);

      const avatarDiv = container.firstChild as HTMLElement;
      expect(avatarDiv.className).toContain("w-12");
      expect(avatarDiv.className).toContain("h-12");
    });

    it("renders large size", () => {
      const { container } = render(
        <ProfileAvatar profile={mockProfile} size="lg" />
      );

      const avatarDiv = container.firstChild as HTMLElement;
      expect(avatarDiv.className).toContain("w-16");
      expect(avatarDiv.className).toContain("h-16");
    });
  });

  describe("with name display", () => {
    it("shows name when showName is true", () => {
      render(<ProfileAvatar profile={mockProfile} showName />);

      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("hides name by default", () => {
      render(<ProfileAvatar profile={mockProfile} />);

      expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    });
  });
});
