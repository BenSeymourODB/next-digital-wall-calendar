import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Skeleton className="mb-8 h-9 w-32" />

      {/* Account section skeleton */}
      <div className="space-y-6">
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-4 h-6 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        {/* Display section skeleton */}
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-4 h-6 w-24" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>

        {/* Rewards section skeleton */}
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-4 h-6 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>

        {/* Tasks section skeleton */}
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-4 h-6 w-24" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
