/**
 * Tests for SettingsSection component
 * Following TDD - tests are written before implementation
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSection } from "../settings-section";

describe("SettingsSection", () => {
  it("renders title", () => {
    render(
      <SettingsSection title="Display Settings">
        <p>Content</p>
      </SettingsSection>
    );

    expect(screen.getByText("Display Settings")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <SettingsSection title="Display Settings">
        <p>Some content here</p>
      </SettingsSection>
    );

    expect(screen.getByText("Some content here")).toBeInTheDocument();
  });

  it("renders optional description", () => {
    render(
      <SettingsSection
        title="Display Settings"
        description="Customize your display preferences"
      >
        <p>Content</p>
      </SettingsSection>
    );

    expect(
      screen.getByText("Customize your display preferences")
    ).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(
      <SettingsSection title="Display Settings">
        <p>Content</p>
      </SettingsSection>
    );

    const card = document.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();
    // Only title should be in the header, no description element
    expect(
      document.querySelector('[data-slot="card-description"]')
    ).not.toBeInTheDocument();
  });

  it("renders within a Card component", () => {
    render(
      <SettingsSection title="Test">
        <p>Content</p>
      </SettingsSection>
    );

    const card = document.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();
  });
});
