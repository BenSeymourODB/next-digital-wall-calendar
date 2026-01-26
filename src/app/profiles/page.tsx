"use client";

/**
 * Profiles Management Page
 *
 * Features:
 * - Displays all profiles in a responsive grid
 * - Allows switching between profiles
 * - Admin users can add new profiles
 * - Back navigation to previous page
 */
import { useProfile } from "@/components/profiles/profile-context";
import {
  ProfileGrid,
  ProfileGridSkeleton,
} from "@/components/profiles/profile-grid";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";

export default function ProfilesPage() {
  const router = useRouter();
  const { allProfiles, activeProfile, isAdmin, isLoading, setActiveProfile } =
    useProfile();

  const handleBack = () => {
    router.back();
  };

  const handleAddProfile = () => {
    // TODO: Navigate to add profile page or open modal
    router.push("/profiles/new");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Back"
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Manage Profiles
              </h1>
              <p className="text-sm text-gray-600">
                Switch between family members or add new profiles
              </p>
            </div>
          </div>

          {/* Add Profile Button - Admin Only */}
          {isAdmin && (
            <Button
              onClick={handleAddProfile}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Profile
            </Button>
          )}
        </div>

        {/* Profile Grid */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {isLoading ? (
            <ProfileGridSkeleton count={4} />
          ) : (
            <ProfileGrid
              profiles={allProfiles}
              activeProfileId={activeProfile?.id ?? null}
              setActiveProfile={setActiveProfile}
            />
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-sm text-gray-500">
          Click on a profile to switch. Each profile has its own calendar view,
          tasks, and settings.
        </p>
      </div>
    </div>
  );
}
