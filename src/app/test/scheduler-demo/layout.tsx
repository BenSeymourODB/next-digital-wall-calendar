"use client";

import { ScreenScheduler } from "@/components/scheduler/screen-scheduler";
import type { ScheduleConfig } from "@/components/scheduler/types";
import type { ReactNode } from "react";

const DEMO_CONFIG: ScheduleConfig = {
  sequences: [
    {
      id: "demo-seq",
      name: "Demo Rotation",
      enabled: true,
      screens: [
        "/test/scheduler-demo",
        "/test/scheduler-demo/screen-b",
        "/test/scheduler-demo/screen-c",
      ],
      intervalSeconds: 10,
      pauseOnInteractionSeconds: 30,
    },
  ],
  timeSpecific: [],
};

export default function SchedulerDemoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ScreenScheduler config={DEMO_CONFIG} autoStart>
      {children}
    </ScreenScheduler>
  );
}
