"use client";

/**
 * PinSettings - Component for managing profile PIN settings
 *
 * Features:
 * - Set up PIN (when no PIN exists)
 * - Change PIN (when PIN exists)
 * - Remove PIN (standard profiles only)
 * - Reset PIN (admin viewing child profile)
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Key, Lock, RefreshCw, Unlock } from "lucide-react";
import { NumericKeypad } from "./numeric-keypad";
import { PinDisplay } from "./pin-display";
import { PinSetupModal } from "./pin-setup-modal";
import type { ProfileAvatar } from "./profile-context";

export interface PinSettingsProfile {
  id: string;
  name: string;
  type: "admin" | "standard";
  pinEnabled: boolean;
  color: string;
  avatar: ProfileAvatar;
}

export interface PinSettingsProps {
  /** Profile to manage PIN for */
  profile: PinSettingsProfile;
  /** Admin profile viewing another profile's settings (enables Reset PIN) */
  viewingAsAdmin?: PinSettingsProfile;
  /** Called when PIN is changed */
  onPinChange: () => void;
}

export function PinSettings({
  profile,
  viewingAsAdmin,
  onPinChange,
}: PinSettingsProps) {
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [adminPinForRemove, setAdminPinForRemove] = useState("");
  const [adminPinForReset, setAdminPinForReset] = useState("");
  const [newPinForReset, setNewPinForReset] = useState("");
  const [resetStep, setResetStep] = useState<"admin-verify" | "new-pin">(
    "admin-verify"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile.type === "admin";
  const hasPIN = profile.pinEnabled;
  const canRemove = !isAdmin && hasPIN;
  const canReset = viewingAsAdmin && viewingAsAdmin.type === "admin" && hasPIN;

  // Handle PIN removal
  const handleRemovePIN = async () => {
    if (!adminPinForRemove) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/profiles/${profile.id}/remove-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: adminPinForRemove }),
      });

      if (response.ok) {
        setRemoveConfirmOpen(false);
        setAdminPinForRemove("");
        onPinChange();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to remove PIN");
      }
    } catch {
      setError("Failed to remove PIN");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle admin PIN verification for reset
  const handleAdminVerify = () => {
    if (adminPinForReset.length >= 4) {
      setResetStep("new-pin");
      setError(null);
    }
  };

  // Handle PIN reset
  const handleResetPIN = async () => {
    if (!viewingAsAdmin || newPinForReset.length < 4) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/profiles/${profile.id}/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminProfileId: viewingAsAdmin.id,
          adminPin: adminPinForReset,
          newPin: newPinForReset,
        }),
      });

      if (response.ok) {
        setResetModalOpen(false);
        setAdminPinForReset("");
        setNewPinForReset("");
        setResetStep("admin-verify");
        onPinChange();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to reset PIN");
        // Go back to admin verify on auth error
        if (response.status === 401) {
          setResetStep("admin-verify");
          setAdminPinForReset("");
        }
      }
    } catch {
      setError("Failed to reset PIN");
    } finally {
      setIsProcessing(false);
    }
  };

  // Close reset modal and reset state
  const closeResetModal = () => {
    setResetModalOpen(false);
    setAdminPinForReset("");
    setNewPinForReset("");
    setResetStep("admin-verify");
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* PIN Status */}
      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
        {hasPIN ? (
          <>
            <Lock className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">PIN Enabled</p>
              <p className="text-sm text-gray-500">
                Your profile is protected with a PIN
              </p>
            </div>
          </>
        ) : (
          <>
            <Unlock className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">PIN Not Set</p>
              <p className="text-sm text-gray-500">
                Add a PIN to protect your profile
              </p>
            </div>
          </>
        )}
      </div>

      {/* Admin PIN requirement notice */}
      {isAdmin && (
        <p className="text-sm text-amber-600">
          Admin profiles require a PIN for security.
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {!hasPIN && (
          <Button
            variant="outline"
            onClick={() => setSetupModalOpen(true)}
            className="gap-2"
          >
            <Key className="h-4 w-4" />
            Set up PIN
          </Button>
        )}

        {hasPIN && (
          <Button
            variant="outline"
            onClick={() => setSetupModalOpen(true)}
            className="gap-2"
          >
            <Key className="h-4 w-4" />
            Change PIN
          </Button>
        )}

        {canRemove && (
          <Button
            variant="outline"
            onClick={() => setRemoveConfirmOpen(true)}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            <Unlock className="h-4 w-4" />
            Remove PIN
          </Button>
        )}

        {canReset && (
          <Button
            variant="outline"
            onClick={() => setResetModalOpen(true)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reset PIN
          </Button>
        )}
      </div>

      {/* Setup/Change PIN Modal */}
      <PinSetupModal
        open={setupModalOpen}
        profile={profile}
        onSuccess={() => {
          setSetupModalOpen(false);
          onPinChange();
        }}
        onClose={() => setSetupModalOpen(false)}
      />

      {/* Remove PIN Confirmation Dialog */}
      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove PIN?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the PIN from this profile? Anyone
              will be able to access it without entering a PIN.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <p className="mb-2 text-sm text-gray-600">
              Enter your current PIN to confirm:
            </p>
            <div className="flex flex-col items-center gap-4">
              <PinDisplay
                value={adminPinForRemove}
                length={4}
                hasError={!!error}
              />
              <NumericKeypad
                value={adminPinForRemove}
                maxLength={6}
                minLength={4}
                onChange={setAdminPinForRemove}
                onBackspace={() =>
                  setAdminPinForRemove((prev) => prev.slice(0, -1))
                }
                onSubmit={handleRemovePIN}
                disabled={isProcessing}
              />
            </div>
            {error && (
              <p className="mt-2 text-center text-sm text-red-600">{error}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setAdminPinForRemove("");
                setError(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemovePIN}
              disabled={adminPinForRemove.length < 4 || isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove PIN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin PIN Reset Modal */}
      <Dialog
        open={resetModalOpen}
        onOpenChange={(open) => !open && closeResetModal()}
      >
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader className="text-center">
            <DialogTitle>
              {resetStep === "admin-verify"
                ? "Enter Your Admin PIN"
                : "Set New PIN"}
            </DialogTitle>
            <DialogDescription>
              {resetStep === "admin-verify"
                ? `Enter your admin PIN to reset PIN for ${profile.name}`
                : `Enter the new PIN for ${profile.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {resetStep === "admin-verify" ? (
              <>
                <PinDisplay
                  value={adminPinForReset}
                  length={4}
                  hasError={!!error}
                />
                <NumericKeypad
                  value={adminPinForReset}
                  maxLength={6}
                  minLength={4}
                  onChange={(v) => {
                    setAdminPinForReset(v);
                    setError(null);
                  }}
                  onBackspace={() =>
                    setAdminPinForReset((prev) => prev.slice(0, -1))
                  }
                  onSubmit={handleAdminVerify}
                  disabled={isProcessing}
                />
              </>
            ) : (
              <>
                <PinDisplay
                  value={newPinForReset}
                  length={4}
                  hasError={!!error}
                />
                <NumericKeypad
                  value={newPinForReset}
                  maxLength={6}
                  minLength={4}
                  onChange={(v) => {
                    setNewPinForReset(v);
                    setError(null);
                  }}
                  onBackspace={() =>
                    setNewPinForReset((prev) => prev.slice(0, -1))
                  }
                  onSubmit={handleResetPIN}
                  disabled={isProcessing}
                />
              </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {resetStep === "new-pin" && (
              <Button
                variant="outline"
                onClick={() => {
                  setResetStep("admin-verify");
                  setNewPinForReset("");
                  setError(null);
                }}
                disabled={isProcessing}
              >
                Back
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={closeResetModal}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
