"use client";

/**
 * Profile Settings Page - Manage individual profile settings
 *
 * Features:
 * - Profile information display
 * - PIN management (via PinSettings component)
 * - Back navigation
 */
import { PinSettings } from "@/components/profiles/pin-settings";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { useProfile } from "@/components/profiles/profile-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const { allProfiles, activeProfile, isLoading, refreshProfiles } =
    useProfile();

  // Find the profile to edit
  const profile = allProfiles.find((p) => p.id === profileId);

  // Redirect if profile not found after loading
  useEffect(() => {
    if (!isLoading && !profile && allProfiles.length > 0) {
      router.push("/profiles");
    }
  }, [isLoading, profile, allProfiles.length, router]);

  const handleBack = () => {
    router.back();
  };

  const handlePinChange = () => {
    refreshProfiles();
  };

  // Loading state
  if (isLoading || !profile) {
    return (
      <div className="container mx-auto max-w-2xl p-4">
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if viewing own profile or viewing as admin
  const isOwnProfile = activeProfile?.id === profile.id;
  const viewingAsAdmin =
    !isOwnProfile && activeProfile?.type === "admin"
      ? activeProfile
      : undefined;

  return (
    <div className="container mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
      </div>

      {/* Profile Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <ProfileAvatar profile={profile} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{profile.name}</h2>
                {profile.type === "admin" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 capitalize">
                {profile.ageGroup} profile
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PIN Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>PIN Security</CardTitle>
          <CardDescription>
            {profile.type === "admin"
              ? "Admin profiles require a PIN for security"
              : "Add a PIN to protect this profile"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PinSettings
            profile={profile}
            viewingAsAdmin={viewingAsAdmin}
            onPinChange={handlePinChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
