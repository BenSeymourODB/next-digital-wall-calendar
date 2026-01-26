"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Server Configuration Error",
    description:
      "There is a problem with the server configuration. Please contact the administrator.",
  },
  AccessDenied: {
    title: "Access Denied",
    description:
      "You do not have permission to sign in. This may be because you denied the requested permissions.",
  },
  Verification: {
    title: "Verification Error",
    description:
      "The verification link may have expired or already been used. Please try signing in again.",
  },
  OAuthSignin: {
    title: "Sign In Error",
    description: "Error starting the OAuth sign-in process. Please try again.",
  },
  OAuthCallback: {
    title: "Callback Error",
    description:
      "Error during the OAuth callback. Please try signing in again.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Error",
    description:
      "Could not create an account. An account with this email may already exist.",
  },
  EmailCreateAccount: {
    title: "Account Creation Error",
    description: "Could not create an account using this email address.",
  },
  Callback: {
    title: "Callback Error",
    description: "An error occurred during the authentication callback.",
  },
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description:
      "This email is already associated with another sign-in method. Please sign in using your original method.",
  },
  SessionRequired: {
    title: "Session Required",
    description: "You must be signed in to access this page.",
  },
  Default: {
    title: "Authentication Error",
    description:
      "An unexpected error occurred during authentication. Please try again.",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const errorInfo = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            {errorInfo.title}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/auth/signin">Try Again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Go Home</Link>
            </Button>
          </div>

          {error !== "Default" && (
            <p className="text-center text-xs text-gray-400">
              Error code: {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
