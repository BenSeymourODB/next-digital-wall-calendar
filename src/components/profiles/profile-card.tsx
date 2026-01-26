"use client";

/**
 * ProfileCard - Displays a profile card with stats
 *
 * Features:
 * - Shows profile avatar, name, and admin badge
 * - Fetches and displays profile stats (points, streak, tasks)
 * - Progress bar with profile color
 * - Click to switch active profile
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "./profile-avatar";
import type { Profile } from "./profile-context";

/**
 * Profile stats from API
 */
interface ProfileStats {
  profileId: string;
  totalPoints: number;
  currentStreak: number;
  tasksToday: number;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  rank: number;
}

interface ProfileCardProps {
  profile: Profile;
  setActiveProfile: (profileId: string) => Promise<void>;
  isActive?: boolean;
}

/**
 * ProfileCard - Interactive card showing profile info and stats
 */
export function ProfileCard({
  profile,
  setActiveProfile,
  isActive = false,
}: ProfileCardProps) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch profile stats
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/profiles/${profile.id}/stats`);
        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }
        const data = await response.json();
        setStats(data);
      } catch {
        setError(true);
        // Set default stats on error
        setStats({
          profileId: profile.id,
          totalPoints: 0,
          currentStreak: 0,
          tasksToday: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
          completionRate: 0,
          rank: 1,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [profile.id]);

  const handleClick = () => {
    setActiveProfile(profile.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveProfile(profile.id);
    }
  };

  // Calculate progress percentage
  const progressPercentage =
    stats && stats.tasksTotal > 0
      ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)
      : 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Switch to ${profile.name} profile`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        isActive && "ring-2 ring-blue-500"
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 pt-6">
        {/* Avatar */}
        <ProfileAvatar profile={profile} size="lg" />

        {/* Name and Admin Badge */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-semibold text-gray-900">{profile.name}</span>
          {profile.type === "admin" && (
            <Badge variant="secondary" className="text-xs">
              Admin
            </Badge>
          )}
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mx-auto h-4 w-3/4" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {/* Tasks Progress */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Tasks</span>
              <span className="font-medium text-gray-900">
                {stats?.tasksCompleted ?? 0}/{stats?.tasksTotal ?? 0}
              </span>
            </div>

            {/* Progress Bar */}
            <Progress
              value={progressPercentage}
              className="h-2"
              style={
                {
                  "--progress-color": profile.color,
                } as React.CSSProperties
              }
            />

            {/* Points and Streak */}
            <div className="flex justify-between text-xs text-gray-500">
              <div className="flex flex-col items-center">
                <span className="font-semibold text-gray-900">
                  {stats?.totalPoints ?? 0}
                </span>
                <span>points</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-semibold text-gray-900">
                  {stats?.currentStreak ?? 0}
                </span>
                <span>streak</span>
              </div>
            </div>
          </div>
        )}

        {/* Error indicator (subtle) */}
        {error && !isLoading && (
          <span className="text-xs text-gray-400">Stats unavailable</span>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ProfileCardSkeleton - Loading placeholder for ProfileCard
 */
export function ProfileCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 pt-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-5 w-24" />
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mx-auto h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
