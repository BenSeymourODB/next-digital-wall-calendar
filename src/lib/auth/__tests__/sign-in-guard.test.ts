/**
 * Unit tests for the sign-in guard that prevents a user from linking multiple
 * Google accounts to the same User record (see issue #61).
 */
import { describe, expect, it } from "vitest";
import { shouldAllowSignIn } from "../sign-in-guard";

type StoredAccount = {
  provider: string;
  providerAccountId: string;
};

describe("shouldAllowSignIn", () => {
  const googleAccount = {
    provider: "google",
    providerAccountId: "google-user-abc",
    type: "oauth",
  };

  it("allows when there is no existing user (fresh sign-up)", () => {
    const result = shouldAllowSignIn({
      user: { id: undefined, email: "new@example.com" },
      account: googleAccount,
      existingAccounts: [],
    });

    expect(result.allow).toBe(true);
  });

  it("allows when incoming account is missing (credentials / email flows)", () => {
    const result = shouldAllowSignIn({
      user: { id: "user-1", email: "u@example.com" },
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
      user: { id: "user-1", email: "u@example.com" },
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
      user: { id: "user-1", email: "u@example.com" },
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
      user: { id: "user-1", email: "u@example.com" },
      account: {
        provider: "github",
        providerAccountId: "gh-123",
        type: "oauth",
      },
      existingAccounts,
    });

    expect(result.allow).toBe(true);
  });

  it("is case-sensitive on provider to avoid treating 'google' and 'Google' as distinct", () => {
    const existingAccounts: StoredAccount[] = [
      { provider: "google", providerAccountId: "google-user-old" },
    ];

    const result = shouldAllowSignIn({
      user: { id: "user-1", email: "u@example.com" },
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
      user: { id: "user-1", email: "u@example.com" },
      account: googleAccount,
      existingAccounts,
    });

    if (result.allow) throw new Error("expected guard to deny");
    expect(result.existingProviderAccountId).toBe("google-user-old-a");
  });
});
