import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Account } from "next-auth";
import { randomBytes } from "node:crypto";
import type { MockedFunction } from "vitest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { encryptLinkedAccount } from "../link-account";

vi.mock("@/lib/db", () => ({
  prisma: {
    account: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

const TEST_KEY_B64 = randomBytes(32).toString("base64");
beforeAll(() => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY_B64);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const mockUpdate = prisma.account.update as unknown as MockedFunction<
  typeof prisma.account.update
>;
const mockLoggerError = logger.error as unknown as MockedFunction<
  typeof logger.error
>;

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    type: "oauth",
    provider: "google",
    providerAccountId: "google-user-123",
    access_token: "plain-access",
    refresh_token: "plain-refresh",
    id_token: "plain-id-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    scope: "openid email profile",
    ...overrides,
  };
}

describe("encryptLinkedAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({} as never);
  });

  it("encrypts access_token, refresh_token, and id_token for a google account", async () => {
    const account = makeAccount();

    await encryptLinkedAccount(account);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdate.mock.calls[0]![0] as {
      data: {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
      };
      where: {
        provider_providerAccountId: {
          provider: string;
          providerAccountId: string;
        };
      };
    };

    expect(callArgs.where).toEqual({
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: "google-user-123",
      },
    });
    expect(callArgs.data.access_token).toMatch(/^v1:/);
    expect(callArgs.data.refresh_token).toMatch(/^v1:/);
    expect(callArgs.data.id_token).toMatch(/^v1:/);
    // All three envelopes should be different (random IVs even for same prefix).
    expect(callArgs.data.access_token).not.toBe(callArgs.data.refresh_token);
  });

  it("skips non-google providers entirely", async () => {
    await encryptLinkedAccount(
      makeAccount({ provider: "github", providerAccountId: "gh-42" })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not call prisma when no token fields are present", async () => {
    await encryptLinkedAccount(
      makeAccount({
        access_token: undefined,
        refresh_token: undefined,
        id_token: undefined,
      })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("only includes fields that are set in the update payload", async () => {
    await encryptLinkedAccount(
      makeAccount({
        access_token: "only-access",
        refresh_token: undefined,
        id_token: undefined,
      })
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const data = (
      mockUpdate.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(Object.keys(data).sort()).toEqual(["access_token"]);
    expect(data.access_token).toMatch(/^v1:/);
  });

  it("catches prisma errors and logs them without rethrowing", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("DB down"));

    await expect(encryptLinkedAccount(makeAccount())).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    const [err, ctx] = mockLoggerError.mock.calls[0]!;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("DB down");
    expect(ctx).toMatchObject({
      context: "LinkAccountEncryptionFailed",
      provider: "google",
    });
  });
});
