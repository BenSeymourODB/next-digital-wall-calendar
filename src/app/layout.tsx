import { AppInsightsProvider } from "@/components/providers/AppInsightsProvider";
import "@/styles/fonts.css";
import "@/styles/odbm.css";
import type { Metadata } from "next";

// Note: Application Insights Server SDK auto-initializes when first imported
// (typically by middleware in src/proxy.ts). No manual initialization needed here.

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"), // TODO: Replace with your actual domain
  title: {
    template: "%s | Our Daily Bread Ministries",
    default: "Welcome | Our Daily Bread Ministries",
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
        <AppInsightsProvider>{children}</AppInsightsProvider>
      </body>
    </html>
  );
}
