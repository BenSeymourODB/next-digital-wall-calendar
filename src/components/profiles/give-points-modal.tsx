"use client";

/**
 * GivePointsModal - Admin-only modal for awarding bonus points
 *
 * Features:
 * - Profile selection dropdown
 * - Points input field
 * - Optional note/reason
 * - Form validation
 * - Loading state during submission
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "./profile-avatar";
import type { Profile } from "./profile-context";

export interface GivePointsModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** All available profiles */
  profiles: Profile[];
  /** The admin profile giving points */
  adminProfile: Profile;
  /** Called when points are awarded successfully */
  onSuccess: () => void;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
}

export function GivePointsModal({
  open,
  profiles,
  adminProfile,
  onSuccess,
  onClose,
}: GivePointsModalProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [points, setPoints] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find first non-admin profile for default selection
  const defaultProfileId =
    profiles.find((p) => p.type !== "admin")?.id || profiles[0]?.id || "";

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedProfileId(defaultProfileId);
      setPoints(null);
      setNote("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, defaultProfileId]);

  // Get selected profile
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedProfileId || !points || points <= 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/profiles/${selectedProfileId}/give-points`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points,
            awardedByProfileId: adminProfile.id,
            note: note || undefined,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        onSuccess();
        return;
      }

      setError(data.error || "Failed to award points");
    } catch {
      setError("Failed to award points. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedProfileId && points && points > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" aria-describedby="give-points-desc">
        <DialogHeader>
          <DialogTitle>Give Bonus Points</DialogTitle>
          <DialogDescription id="give-points-desc">
            Award bonus points to a family member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Selection */}
          <div className="space-y-2">
            <Label htmlFor="profile-select">Select Profile</Label>
            <Select
              value={selectedProfileId}
              onValueChange={setSelectedProfileId}
            >
              <SelectTrigger id="profile-select" className="w-full">
                <SelectValue placeholder="Select a profile">
                  {selectedProfile && (
                    <div className="flex items-center gap-2">
                      <ProfileAvatar profile={selectedProfile} size="sm" />
                      <span>{selectedProfile.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <ProfileAvatar profile={profile} size="sm" />
                      <span>{profile.name}</span>
                      {profile.type === "admin" && (
                        <span className="text-xs text-gray-500">(Admin)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Points Input */}
          <div className="space-y-2">
            <Label htmlFor="points-input">Points to Award</Label>
            <Input
              id="points-input"
              type="number"
              min="1"
              max="1000"
              value={points ?? ""}
              onChange={(e) =>
                setPoints(e.target.value ? parseInt(e.target.value, 10) : null)
              }
              placeholder="Enter points"
              disabled={isSubmitting}
            />
          </div>

          {/* Note Input */}
          <div className="space-y-2">
            <Label htmlFor="note-input">Reason (optional)</Label>
            <Input
              id="note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Helped with dishes"
              disabled={isSubmitting}
            />
          </div>

          {/* Error Message */}
          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? "Awarding..." : "Give Points"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
