import { AppInsightsProvider } from "@/components/providers/AppInsightsProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
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
    <html lang="en">
      <body className="font-sans antialiased">
        <SessionProvider>
          <AppInsightsProvider>{children}</AppInsightsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
