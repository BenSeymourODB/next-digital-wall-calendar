/**
 * Application Insights Provider
 *
 * Initializes the Application Insights Browser SDK and wraps the app
 * with error boundary. Should be added to the root layout.
 *
 * Features:
 * - Initializes client SDK on mount
 * - Auto-tracks page views and route changes
 * - Wraps children with ErrorBoundary
 * - Handles global unhandled promise rejections
 *
 * Usage in layout.tsx:
 *   <AppInsightsProvider>
 *     {children}
 *   </AppInsightsProvider>
 */

"use client";

import { initializeAppInsights } from "@/lib/appinsights-client";
import { ReactNode, useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface AppInsightsProviderProps {
  children: ReactNode;
}

export function AppInsightsProvider({ children }: AppInsightsProviderProps) {
  // Initialize Application Insights on mount
  useEffect(() => {
    initializeAppInsights();
  }, []);

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
