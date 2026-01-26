"use client";

/**
 * PinSetupModal - Modal for setting up or changing PIN
 *
 * Features:
 * - Two-step flow: Create PIN → Confirm PIN
 * - Validation tips
 * - Mismatch error handling
 * - Required mode for admin profiles (cannot cancel)
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

export interface PinSetupModalProfile {
  id: string;
  name: string;
  pinEnabled: boolean;
}

export interface PinSetupModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Profile to set up PIN for */
  profile: PinSetupModalProfile;
  /** Current PIN (required when changing existing PIN) */
  currentPin?: string;
  /** Length of the PIN */
  pinLength?: number;
  /** Whether PIN is required (cannot cancel) */
  required?: boolean;
  /** Called when PIN is saved successfully */
  onSuccess: () => void;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
}

type Step = "create" | "confirm";

export function PinSetupModal({
  open,
  profile,
  currentPin,
  pinLength = 4,
  required = false,
  onSuccess,
  onClose,
}: PinSetupModalProps) {
  const [step, setStep] = useState<Step>("create");
  const [pin, setPin] = useState("");
  const [createdPin, setCreatedPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStep("create");
      setPin("");
      setCreatedPin("");
      setError(null);
      setHasError(false);
      setIsSaving(false);
    }
  }, [open]);

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

  // Handle submit for step 1 (advance to step 2)
  const handleStep1Submit = () => {
    if (pin.length < 4) return;
    setCreatedPin(pin);
    setPin("");
    setStep("confirm");
    setError(null);
    setHasError(false);
  };

  // Handle submit for step 2 (verify match and save)
  const handleStep2Submit = async () => {
    if (pin.length < 4) return;

    // Check if PINs match
    if (pin !== createdPin) {
      setError("PINs do not match. Please try again.");
      setHasError(true);
      setPin("");
      return;
    }

    // Save PIN
    setIsSaving(true);
    setError(null);

    try {
      const body: { pin: string; currentPin?: string } = { pin };
      if (currentPin) {
        body.currentPin = currentPin;
      }

      const response = await fetch(`/api/profiles/${profile.id}/set-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSuccess();
        return;
      }

      setError(data.error || "Failed to set PIN");
      setHasError(true);
    } catch {
      setError("Failed to save PIN. Please try again.");
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle submit based on current step
  const handleSubmit = () => {
    if (step === "create") {
      handleStep1Submit();
    } else {
      handleStep2Submit();
    }
  };

  // Handle back button in step 2
  const handleBack = () => {
    setStep("create");
    setPin(createdPin); // Restore the created PIN
    setError(null);
    setHasError(false);
  };

  const isChanging = profile.pinEnabled;
  const title = isChanging ? "Change PIN" : "Create a PIN";
  const subtitle =
    step === "create"
      ? "Enter a new PIN to secure your profile"
      : "Confirm your PIN";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !required && onClose()}
    >
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        aria-describedby="pin-setup-description"
      >
        <DialogHeader className="text-center">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="pin-setup-description">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                step === "create"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              1
            </span>
            <span className="h-0.5 w-8 bg-gray-200" />
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                step === "confirm"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              2
            </span>
          </div>

          {/* PIN Display */}
          <PinDisplay value={pin} length={pinLength} hasError={hasError} />

          {/* Tips on step 1 */}
          {step === "create" && (
            <p className="text-center text-xs text-gray-500">
              Use 4-6 digits. Avoid easy patterns like 1234.
            </p>
          )}

          {/* Required message */}
          {required && (
            <p className="text-center text-xs text-amber-600">
              PIN is required for admin profiles.
            </p>
          )}

          {/* Error message */}
          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          {/* Numeric Keypad */}
          <NumericKeypad
            value={pin}
            maxLength={pinLength}
            minLength={4}
            onChange={handleChange}
            onBackspace={handleBackspace}
            onSubmit={handleSubmit}
            disabled={isSaving}
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            {step === "confirm" && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSaving}
              >
                Back
              </Button>
            )}
            {!required && (
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isSaving}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
