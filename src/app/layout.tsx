import { AppShell } from "@/components/navigation/app-shell";
import { AppInsightsProvider } from "@/components/providers/AppInsightsProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import type { Metadata } from "next";
import "./globals.css";

// Note: Application Insights Server SDK auto-initializes when first imported
// (typically by middleware in src/proxy.ts). No manual initialization needed here.

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"), // TODO: Replace with your actual domain
  title: {
    template: "%s | Digital Wall Calendar",
    default: "Welcome | Digital Wall Calendar",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <SessionProvider>
          <ThemeProvider>
            <AppInsightsProvider>
              <AppShell>{children}</AppShell>
            </AppInsightsProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
