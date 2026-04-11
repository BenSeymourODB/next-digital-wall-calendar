/**
 * Shared test helpers for Prisma mock setup.
 *
 * Extracts common patterns like $transaction mocking that are
 * duplicated across multiple API route test files.
 */
import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

/**
 * Configure a mock Prisma.$transaction to execute the callback with
 * the given transaction model mocks.
 *
 * Replaces the 11-21 line inline $transaction mock pattern that was
 * previously copied 6+ times in give-points/route.test.ts.
 *
 * @example
 * ```ts
 * mockTransaction(mockPrisma, {
 *   profileRewardPoints: {
 *     upsert: vi.fn().mockResolvedValue({ totalPoints: 50 }),
 *   },
 *   pointTransaction: {
 *     create: vi.fn().mockResolvedValue({}),
 *   },
 * });
 * ```
 */
export function mockTransaction(
  mockPrisma: { $transaction: MockFn },
  txModels: Record<string, Record<string, MockFn>>
) {
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof txModels) => Promise<unknown>) =>
      callback(txModels)
  );
}
