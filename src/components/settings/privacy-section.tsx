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
import { toast } from "sonner";
import { SettingsSection } from "./settings-section";

interface PrivacySectionProps {
  permissions: string[];
  onDeleteAllData: () => Promise<void>;
}

export function PrivacySection({
  permissions,
  onDeleteAllData,
}: PrivacySectionProps) {
  return (
    <SettingsSection
      title="Privacy"
      description="Manage your data and permissions"
    >
      <div className="space-y-6">
        {permissions.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700">
              Connected permissions
            </p>
            <ul className="mt-2 space-y-1">
              {permissions.map((permission) => (
                <li key={permission} className="text-sm text-gray-600">
                  {permission}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => toast.info("Coming soon")}>
            Export data
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete all data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all
                  of your data including settings, profiles, and reward points.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteAllData}>
                  Yes, delete all data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SettingsSection>
  );
}
