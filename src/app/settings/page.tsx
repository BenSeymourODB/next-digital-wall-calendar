import { SettingsForm } from "@/components/settings/settings-form";
import { getSession } from "@/lib/auth";
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
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Settings</h1>
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
          rewardSystemEnabled: settings.rewardSystemEnabled,
          defaultTaskPoints: settings.defaultTaskPoints,
          showPointsOnCompletion: settings.showPointsOnCompletion,
        }}
      />
    </div>
  );
}
