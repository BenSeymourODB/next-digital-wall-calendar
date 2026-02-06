"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { SettingsSection } from "./settings-section";

interface AccountUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface AccountSectionProps {
  user: AccountUser;
  createdAt: string;
  providers: string[];
  onDeleteAccount: () => Promise<void>;
}

export function AccountSection({
  user,
  createdAt,
  providers,
  onDeleteAccount,
}: AccountSectionProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <SettingsSection title="Account" description="Manage your account settings">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {user.image && (
            <img
              src={user.image}
              alt={user.name ?? "User avatar"}
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {user.name ?? "Unknown User"}
            </p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>Member since {formattedDate}</p>
        </div>

        <div className="text-sm">
          <p className="font-medium text-gray-700">Connected providers</p>
          <ul className="mt-1 space-y-1">
            {providers.map((provider) => (
              <li key={provider} className="text-gray-600 capitalize">
                {provider}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your account and remove all of your data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SettingsSection>
  );
}
