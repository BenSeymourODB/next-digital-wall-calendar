import { AppInsightsProvider } from "@/components/providers/AppInsightsProvider";
import type { Metadata } from "next";
import Script from "next/script";

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
        {/* Google Identity Services - Load globally for OAuth */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          async
        />
        {/* Google API Client - Load globally for Calendar API */}
        <Script
          src="https://apis.google.com/js/api.js"
          strategy="afterInteractive"
          async
        />
        <AppInsightsProvider>{children}</AppInsightsProvider>
      </body>
    </html>
  );
}
