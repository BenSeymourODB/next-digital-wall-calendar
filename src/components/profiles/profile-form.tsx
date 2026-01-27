/**
 * Profile creation/edit form component
 *
 * Features:
 * - Name input with validation
 * - Color picker for profile color
 * - Profile type selection (admin/standard)
 * - Age group selection (adult/teen/child)
 * - Live avatar preview
 * - First profile admin enforcement
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { ColorPicker, PROFILE_COLORS } from "./color-picker";

/**
 * Profile type options
 */
type ProfileType = "admin" | "standard";
type AgeGroup = "adult" | "teen" | "child";

/**
 * Profile form props
 */
export interface ProfileFormProps {
  /** Callback when profile is successfully created */
  onSuccess: (profile: { id: string; name: string; type: string }) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether this is the first profile (must be admin) */
  isFirstProfile: boolean;
}

/**
 * Generate initials from a name
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return "";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Profile creation form component
 */
export function ProfileForm({
  onSuccess,
  onCancel,
  isFirstProfile,
}: ProfileFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROFILE_COLORS[0].hex);
  const [type, setType] = useState<ProfileType>(
    isFirstProfile ? "admin" : "standard"
  );
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("adult");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const initials = getInitials(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    // Validate name
    if (!name.trim()) {
      setValidationError("Name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: isFirstProfile ? "admin" : type,
          ageGroup,
          color,
          avatar: {
            type: "initials",
            value: initials,
            backgroundColor: color,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create profile");
        return;
      }

      onSuccess(data);
    } catch {
      setError("Failed to create profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error display */}
      {(error || validationError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error || validationError}
        </div>
      )}

      {/* Avatar preview */}
      <div className="flex flex-col items-center gap-4">
        <div
          data-testid="avatar-preview"
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials || "?"}
        </div>
        <p className="text-sm text-gray-500">Avatar Preview</p>
      </div>

      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setValidationError(null);
          }}
          placeholder="Enter name"
          disabled={isSubmitting}
        />
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <Label>Profile Color</Label>
        <ColorPicker
          value={color}
          onChange={setColor}
          disabled={isSubmitting}
        />
      </div>

      {/* Profile type */}
      <div className="space-y-2">
        <Label htmlFor="type">Profile Type</Label>
        {isFirstProfile && (
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-600">
            <Info className="h-4 w-4" />
            <span>First profile must be an admin</span>
          </div>
        )}
        <Select
          value={type}
          onValueChange={(value: ProfileType) => setType(value)}
          disabled={isFirstProfile || isSubmitting}
        >
          <SelectTrigger id="type" aria-label="Profile Type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin (Parent)</SelectItem>
            <SelectItem value="standard">Standard (Child)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Age group */}
      <div className="space-y-2">
        <Label htmlFor="ageGroup">Age Group</Label>
        <Select
          value={ageGroup}
          onValueChange={(value: AgeGroup) => setAgeGroup(value)}
          disabled={isSubmitting}
        >
          <SelectTrigger id="ageGroup" aria-label="Age Group">
            <SelectValue placeholder="Select age group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adult">Adult</SelectItem>
            <SelectItem value="teen">Teen</SelectItem>
            <SelectItem value="child">Child</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("flex-1", isSubmitting && "opacity-70")}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Profile"
          )}
        </Button>
      </div>
    </form>
  );
}
