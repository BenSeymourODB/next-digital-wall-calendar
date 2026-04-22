/**
 * Unit tests for the sign-in guard that prevents a user from linking multiple
 * Google accounts to the same User record (see issue #61).
 */
import { describe, expect, it } from "vitest";
import {
  type StoredAccount,
  lastSix,
  shouldAllowSignIn,
} from "../sign-in-guard";

describe("shouldAllowSignIn", () => {
  const googleAccount = {
    provider: "google",
    providerAccountId: "google-user-abc",
    type: "oauth",
  };

  it("allows when existingAccounts is empty (fresh sign-up or new provider)", () => {
    const result = shouldAllowSignIn({
      account: googleAccount,
      existingAccounts: [],
    });

    expect(result.allow).toBe(true);
  });

  it("allows when the incoming account is null (credentials / email flows)", () => {
    const result = shouldAllowSignIn({
      account: null,
      existingAccounts: [],
    });

    expect(result.allow).toBe(true);
  });

  it("allows when the incoming account already exists on the user (re-sign-in)", () => {
    const existingAccounts: StoredAccount[] = [
      { provider: "google", providerAccountId: "google-user-abc" },
    ];

    const result = shouldAllowSignIn({
      account: googleAccount,
      existingAccounts,
    });

    expect(result.allow).toBe(true);
  });

  it("denies when a different Google identity tries to link onto a user that already has a Google account", () => {
    const existingAccounts: StoredAccount[] = [
      { provider: "google", providerAccountId: "google-user-old" },
    ];

    const result = shouldAllowSignIn({
      account: googleAccount,
      existingAccounts,
    });

    if (result.allow) throw new Error("expected guard to deny");
    expect(result.reason).toMatch(/already linked/i);
    expect(result.existingProviderAccountId).toBe("google-user-old");
  });

  it("allows linking a different provider when Google is already linked", () => {
    const existingAccounts: StoredAccount[] = [
      { provider: "google", providerAccountId: "google-user-abc" },
    ];

    const result = shouldAllowSignIn({
      account: {
        provider: "github",
        providerAccountId: "gh-123",
        type: "oauth",
      },
      existingAccounts,
    });

    expect(result.allow).toBe(true);
  });

  it("treats providers case-sensitively so 'google' and 'Google' are distinct", () => {
    // A stored 'Google' row must not match an incoming 'google' account.
    // Comparisons use ===, so different casing is a different provider and
    // should be allowed to link (and vice versa).
    const existingAccounts: StoredAccount[] = [
      { provider: "Google", providerAccountId: "google-user-old" },
    ];

    const result = shouldAllowSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-user-new",
        type: "oauth",
      },
      existingAccounts,
    });

    expect(result.allow).toBe(true);
  });

  it("denies same-provider sign-in with a different providerAccountId", () => {
    const existingAccounts: StoredAccount[] = [
      { provider: "google", providerAccountId: "google-user-old" },
    ];

    const result = shouldAllowSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-user-new",
        type: "oauth",
      },
      existingAccounts,
    });

    expect(result.allow).toBe(false);
  });

  it("handles multiple existing accounts on the same provider by reporting the first match", () => {
    const existingAccounts: StoredAccount[] = [
      { provider: "google", providerAccountId: "google-user-old-a" },
      { provider: "google", providerAccountId: "google-user-old-b" },
    ];

    const result = shouldAllowSignIn({
      account: googleAccount,
      existingAccounts,
    });

    if (result.allow) throw new Error("expected guard to deny");
    expect(result.existingProviderAccountId).toBe("google-user-old-a");
  });
});

describe("lastSix", () => {
  it("returns the last 6 characters of a long identifier", () => {
    expect(lastSix("google-user-1234567890")).toBe("567890");
  });

  it("returns the whole string when it is 6 characters or shorter", () => {
    expect(lastSix("abc")).toBe("abc");
    expect(lastSix("abcdef")).toBe("abcdef");
  });

  it("handles the empty string without throwing", () => {
    expect(lastSix("")).toBe("");
  });
});
