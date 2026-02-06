"use client";

/**
 * TaskAssignmentPicker - Dropdown to assign profiles to a task
 *
 * Features:
 * - Shows assigned profile avatars
 * - Dropdown with checkboxes for each profile
 * - Multi-select support
 * - API integration for saving assignments
 */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Users } from "lucide-react";

export interface ProfileInfo {
  id: string;
  name: string;
  color: string;
  avatar: {
    type: "initials" | "photo" | "emoji";
    value: string;
    backgroundColor?: string;
  };
}

export interface TaskAssignmentPickerProps {
  /** Google Tasks ID */
  taskId: string;
  /** Available profiles to assign */
  profiles: ProfileInfo[];
  /** Currently assigned profile IDs */
  assignedProfileIds: string[];
  /** Called when assignments change */
  onChange: (profileIds: string[]) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

interface AssignmentResponse {
  assignments: Array<{
    profileId: string;
    profile: ProfileInfo;
  }>;
}

export function TaskAssignmentPicker({
  taskId,
  profiles,
  assignedProfileIds,
  onChange,
  disabled = false,
  className,
}: TaskAssignmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignedProfiles = profiles.filter((p) =>
    assignedProfileIds.includes(p.id)
  );

  const handleToggleProfile = async (profileId: string) => {
    setLoading(true);
    setError(null);

    const isCurrentlyAssigned = assignedProfileIds.includes(profileId);
    const newProfileIds = isCurrentlyAssigned
      ? assignedProfileIds.filter((id) => id !== profileId)
      : [...assignedProfileIds, profileId];

    try {
      const response = await fetch(`/api/tasks/${taskId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: newProfileIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to update assignments");
      }

      const data = (await response.json()) as AssignmentResponse;
      onChange(data.assignments.map((a) => a.profileId));
    } catch {
      setError("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || loading}
          className={cn("gap-1", className)}
          aria-label={
            assignedProfiles.length > 0
              ? `Assigned to ${assignedProfiles.map((p) => p.name).join(", ")}`
              : "Assign task"
          }
        >
          {assignedProfiles.length > 0 ? (
            <div className="flex -space-x-2">
              {assignedProfiles.slice(0, 3).map((profile) => (
                <div
                  key={profile.id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white"
                  style={{ backgroundColor: profile.color }}
                  title={profile.name}
                >
                  {profile.avatar.type === "initials"
                    ? profile.avatar.value.charAt(0)
                    : profile.avatar.type === "emoji"
                      ? profile.avatar.value
                      : profile.name.charAt(0)}
                </div>
              ))}
              {assignedProfiles.length > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-400 text-xs font-medium text-white">
                  +{assignedProfiles.length - 3}
                </div>
              )}
            </div>
          ) : (
            <>
              <Users className="h-4 w-4" />
              <span className="text-xs">Assign</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {profiles.map((profile) => (
            <label
              key={profile.id}
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-100"
            >
              <Checkbox
                checked={assignedProfileIds.includes(profile.id)}
                onCheckedChange={() => handleToggleProfile(profile.id)}
                disabled={loading}
                aria-label={profile.name}
              />
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: profile.color }}
              >
                {profile.avatar.type === "initials"
                  ? profile.avatar.value.charAt(0)
                  : profile.avatar.type === "emoji"
                    ? profile.avatar.value
                    : profile.name.charAt(0)}
              </div>
              <span className="text-sm">{profile.name}</span>
            </label>
          ))}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
