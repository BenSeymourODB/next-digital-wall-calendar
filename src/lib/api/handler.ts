import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type AuthedSession = Session & { user: { id: string } };

export async function requireUserSession(): Promise<AuthedSession> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new ApiError("Unauthorized", 401);
  }
  return session as AuthedSession;
}

interface WithApiHandlerOptions {
  endpoint: string;
  method: string;
  errorMessage: string;
}

export function withApiHandler<TArgs extends unknown[]>(
  options: WithApiHandlerOptions,
  handler: (...args: TArgs) => Promise<NextResponse>
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logger.error(errorObj, {
        endpoint: options.endpoint,
        method: options.method,
      });
      return NextResponse.json(
        { error: options.errorMessage },
        { status: 500 }
      );
    }
  };
}
