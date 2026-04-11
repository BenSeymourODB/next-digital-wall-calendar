"use client";

import { ProfileProvider } from "@/components/profiles/profile-context";
import { ReactNode } from "react";

export default function ProfilesLayout({ children }: { children: ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}
