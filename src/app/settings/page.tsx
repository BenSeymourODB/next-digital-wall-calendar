import { SettingsForm } from "@/components/settings/settings-form";
import { isTimeFormat } from "@/hooks/use-user-settings";
import { getSession } from "@/lib/auth";
import {
  DEFAULT_CALENDAR_TRANSITION_SPEED,
  isCalendarTransitionSpeed,
} from "@/lib/calendar/transition-speed";
import { prisma } from "@/lib/db";
import { DEFAULT_DATE_FORMAT, isDateFormat } from "@/lib/format-date";
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
          // Coerce the Prisma `string` to the application-level `TTimeFormat`
          // union; fall back to the schema default if a manually-edited row
          // ever contains a non-allow-listed value. Parallel to the
          // `calendarTransitionSpeed` shape below.
          timeFormat: isTimeFormat(settings.timeFormat)
            ? settings.timeFormat
            : "12h",
          // Narrow at the boundary so the form's `UserSettingsData` can
          // carry the strong `TDateFormat` type — a stale DB row with an
          // unknown value falls back to the schema default.
          dateFormat: isDateFormat(settings.dateFormat)
            ? settings.dateFormat
            : DEFAULT_DATE_FORMAT,
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
