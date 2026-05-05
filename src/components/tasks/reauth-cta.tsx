"use client";

/**
 * ReauthCta - shared "Sign in again" button rendered when a tasks API
 * response indicates the stored Google grant is missing or expired
 * (`TaskApiError.requiresReauth === true`).
 *
 * Both `NewTaskModal` and `TaskList` use this so the affordance has a
 * single home. Clicking calls `signIn("google", { callbackUrl })` with a
 * callbackUrl that preserves pathname + search, so the OAuth round-trip
 * lands the user back on their current view (e.g. `/calendar?date=…&view=week`).
 * NextAuth validates `callbackUrl` against `NEXTAUTH_URL`, so there is
 * no open-redirect risk.
 */
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

export interface ReauthCtaProps {
  /** Override the default "Sign in again" label. */
  label?: string;
  /** Additional CSS classes forwarded to the underlying Button. */
  className?: string;
}

export function ReauthCta({
  label = "Sign in again",
  className,
}: ReauthCtaProps) {
  const handleClick = () => {
    const callbackUrl =
      typeof window === "undefined"
        ? "/"
        : window.location.pathname + window.location.search;
    signIn("google", { callbackUrl });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      className={className}
    >
      {label}
    </Button>
  );
}
