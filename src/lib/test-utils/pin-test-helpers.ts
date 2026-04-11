/**
 * Shared test helpers for PIN-related API route tests.
 *
 * The 4 PIN route test files (set-pin, verify-pin, reset-pin, remove-pin)
 * share identical mock setup patterns. This module extracts the common
 * typed mock casts and helper factories to reduce duplication.
 *
 * NOTE: vi.mock() calls must remain at the module scope of each test file
 * because Vitest hoists them. This module provides the type casts and
 * setup helpers that come after the mocks.
 */
import type { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { vi } from "vitest";

/**
 * Type for the mocked Prisma client used in PIN route tests.
 */
export interface MockPinPrisma {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

/**
 * Cast the mocked prisma import to typed mocks for PIN route tests.
 */
export function castPinPrisma(prismaMock: typeof prisma): MockPinPrisma {
  return prismaMock as unknown as MockPinPrisma;
}

/**
 * Create a mock profile object with PIN-related fields.
 */
export function mockPinProfile(overrides: {
  id: string;
  pinEnabled?: boolean;
  pinHash?: string | null;
  failedPinAttempts?: number;
  pinLockedUntil?: Date | null;
  type?: "admin" | "standard" | "child";
  [key: string]: unknown;
}) {
  return {
    userId: "user-1",
    name: "Test Profile",
    type: "standard" as const,
    ageGroup: "adult" as const,
    color: "#3b82f6",
    avatar: { type: "initials", value: "TP", backgroundColor: "#3b82f6" },
    pinEnabled: false,
    pinHash: null,
    failedPinAttempts: 0,
    pinLockedUntil: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Configure bcrypt.compare mock to return true (successful PIN verification).
 */
export function setupSuccessfulPinVerification() {
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
}

/**
 * Configure bcrypt.compare mock to return false (failed PIN verification).
 */
export function setupFailedPinVerification() {
  vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
}

/**
 * Configure bcrypt.hash mock to return a given hash string.
 */
export function setupPinHashing(hash = "$2b$10$newHashedPin") {
  vi.mocked(bcrypt.hash).mockResolvedValue(hash as never);
}
