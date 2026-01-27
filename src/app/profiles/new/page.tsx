/**
 * Profile Creation Page
 *
 * Allows users to create a new family profile with:
 * - Name and avatar
 * - Color selection
 * - Profile type (admin/standard)
 * - Age group
 */
"use client";

import { useProfile } from "@/components/profiles/profile-context";
import { ProfileForm } from "@/components/profiles/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

export default function NewProfilePage() {
  const router = useRouter();
  const { allProfiles, isLoading, refreshProfiles } = useProfile();

  // Determine if this is the first profile
  const isFirstProfile = !isLoading && allProfiles.length === 0;

  const handleSuccess = async () => {
    await refreshProfiles();
    router.push("/profiles");
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-md p-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="mx-auto h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {isFirstProfile ? "Create Your Profile" : "Add Family Member"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            isFirstProfile={isFirstProfile}
          />
        </CardContent>
      </Card>
    </div>
  );
}
