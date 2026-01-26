"use client";

/**
 * PinEntryModal - Modal for entering PIN to access a profile
 *
 * Features:
 * - Profile avatar and name display
 * - PIN entry with numeric keypad
 * - Error messages and attempts remaining
 * - Lockout timer display
 * - Cancel option
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { NumericKeypad } from "./numeric-keypad";
import { PinDisplay } from "./pin-display";
import { ProfileAvatar } from "./profile-avatar";
import type { ProfileAvatar as ProfileAvatarType } from "./profile-context";

export interface PinEntryModalProfile {
  id: string;
  name: string;
  color: string;
  avatar: ProfileAvatarType;
}

export interface PinEntryModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Profile to enter PIN for */
  profile: PinEntryModalProfile;
  /** Length of the PIN */
  pinLength?: number;
  /** Called when PIN is verified successfully */
  onSuccess: () => void;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
}

export function PinEntryModal({
  open,
  profile,
  pinLength = 4,
  onSuccess,
  onClose,
}: PinEntryModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null
  );
  const [lockedFor, setLockedFor] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPin("");
      setError(null);
      setAttemptsRemaining(null);
      setLockedFor(null);
      setIsVerifying(false);
      setHasError(false);
    }
  }, [open]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockedFor === null || lockedFor <= 0) return;

    const timer = setInterval(() => {
      setLockedFor((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockedFor]);

  // Format lockout time
  const formatLockoutTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Handle digit input
  const handleChange = (newValue: string) => {
    setPin(newValue);
    setError(null);
    setHasError(false);
  };

  // Handle backspace
  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
    setHasError(false);
  };

  // Handle PIN submission
  const handleSubmit = async () => {
    if (pin.length === 0 || isVerifying) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`/api/profiles/${profile.id}/verify-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSuccess();
        return;
      }

      // Handle lockout
      if (data.lockedFor) {
        setLockedFor(data.lockedFor);
        setError("Profile locked due to too many failed attempts");
        setPin("");
        setHasError(true);
        return;
      }

      // Handle incorrect PIN
      setError(data.error || "Incorrect PIN");
      setAttemptsRemaining(data.attemptsRemaining ?? null);
      setPin("");
      setHasError(true);
    } catch {
      setError("Failed to verify PIN. Please try again.");
      setHasError(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const isLocked = lockedFor !== null && lockedFor > 0;
  const isDisabled = isVerifying || isLocked;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        aria-describedby="pin-entry-description"
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2">
            <ProfileAvatar profile={profile} size="lg" />
          </div>
          <DialogTitle>{profile.name}</DialogTitle>
          <DialogDescription id="pin-entry-description">
            Enter your PIN to continue
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6">
          {/* PIN Display */}
          <PinDisplay value={pin} length={pinLength} hasError={hasError} />

          {/* Error message */}
          {error && (
            <div className="text-center">
              <p className="text-sm text-red-600">{error}</p>
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {attemptsRemaining} attempt
                  {attemptsRemaining !== 1 ? "s" : ""} remaining
                </p>
              )}
            </div>
          )}

          {/* Lockout timer */}
          {isLocked && (
            <div className="text-center">
              <p className="text-sm text-red-600">
                Locked for {formatLockoutTime(lockedFor!)}
              </p>
            </div>
          )}

          {/* Numeric Keypad */}
          <NumericKeypad
            value={pin}
            maxLength={pinLength}
            onChange={handleChange}
            onBackspace={handleBackspace}
            onSubmit={handleSubmit}
            disabled={isDisabled}
          />

          {/* Cancel button */}
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
