import { SettingsForm } from "@/components/settings/settings-form";
import { getSession } from "@/lib/auth";
import {
  DEFAULT_CALENDAR_TRANSITION_SPEED,
  isCalendarTransitionSpeed,
} from "@/lib/calendar/transition-speed";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const userId = session.user.id;

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: {
        select: { provider: true },
      },
    },
  });

  const providers = user?.accounts.map((a) => a.provider) ?? [];
  const createdAt = user?.createdAt?.toISOString() ?? new Date().toISOString();

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <h1 className="text-foreground mb-8 text-3xl font-bold">Settings</h1>
      <SettingsForm
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
        createdAt={createdAt}
        providers={providers}
        initialSettings={{
          theme: settings.theme,
          timeFormat: settings.timeFormat,
          dateFormat: settings.dateFormat,
          defaultZoomLevel: settings.defaultZoomLevel,
          // Clamp defensively so a manually-edited DB row of e.g. 5 doesn't
          // poison every `weekStartsOn` parameter; only 0/1 are valid here.
          weekStartDay: settings.weekStartDay === 1 ? 1 : 0,
          rewardSystemEnabled: settings.rewardSystemEnabled,
          defaultTaskPoints: settings.defaultTaskPoints,
          showPointsOnCompletion: settings.showPointsOnCompletion,
          schedulerIntervalSeconds: settings.schedulerIntervalSeconds,
          schedulerPauseOnInteractionSeconds:
            settings.schedulerPauseOnInteractionSeconds,
          calendarRefreshIntervalMinutes:
            settings.calendarRefreshIntervalMinutes,
          calendarFetchMonthsAhead: settings.calendarFetchMonthsAhead,
          calendarFetchMonthsBehind: settings.calendarFetchMonthsBehind,
          calendarMaxEventsPerDay: settings.calendarMaxEventsPerDay,
          calendarWorkingHoursStart: settings.calendarWorkingHoursStart,
          calendarTransitionSpeed: isCalendarTransitionSpeed(
            settings.calendarTransitionSpeed
          )
            ? settings.calendarTransitionSpeed
            : DEFAULT_CALENDAR_TRANSITION_SPEED,
        }}
      />
    </div>
  );
}
