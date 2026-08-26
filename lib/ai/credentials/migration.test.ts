import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  systemFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  credentialFindFirst: vi.fn(),
  credentialCreate: vi.fn(),
  decryptApiKey: vi.fn(),
  maskApiKey: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    systemSettings: { findUnique: mocks.systemFindUnique },
    userSettings: { findMany: mocks.userFindMany },
    aiCredential: { findFirst: mocks.credentialFindFirst, create: mocks.credentialCreate },
  },
}));
vi.mock("@/lib/ai/encryption", () => ({ decryptApiKey: mocks.decryptApiKey, maskApiKey: mocks.maskApiKey }));

import { migrateLegacyAiCredentials } from "@/lib/ai/credentials/migration";

describe("migrateLegacyAiCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.systemFindUnique.mockResolvedValue(null);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.credentialFindFirst.mockResolvedValue(null);
    mocks.credentialCreate.mockResolvedValue({});
    mocks.maskApiKey.mockReturnValue("sk-...key");
  });

  it("migrates non-empty system and user keys", async () => {
    mocks.systemFindUnique.mockResolvedValue({ singletonKey: "system", openaiApiKey: "enc-openai", geminiApiKey: null, openrouterApiKey: null });
    mocks.userFindMany.mockResolvedValue([{ userId: "u1", openaiApiKey: "enc-user", geminiApiKey: null, openrouterApiKey: null }]);
    mocks.decryptApiKey.mockImplementation((value: string) => `plain:${value}`);

    const result = await migrateLegacyAiCredentials();

    expect(result).toEqual({ scanned: 6, migrated: 2, skipped: 4, invalid: 0 });
    expect(mocks.credentialCreate).toHaveBeenCalledTimes(2);
    expect(mocks.credentialCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ scope: "USER", userId: "u1" }) }));
  });

  it("skips empty values and counts invalid encrypted values", async () => {
    mocks.systemFindUnique.mockResolvedValue({ singletonKey: "system", openaiApiKey: "bad", geminiApiKey: "", openrouterApiKey: null });
    mocks.decryptApiKey.mockReturnValue("");

    const result = await migrateLegacyAiCredentials();

    expect(result).toEqual({ scanned: 3, migrated: 0, skipped: 2, invalid: 1 });
    expect(mocks.credentialCreate).not.toHaveBeenCalled();
  });

  it("is idempotent when the scoped credential already exists", async () => {
    mocks.systemFindUnique.mockResolvedValue({ singletonKey: "system", openaiApiKey: "enc-openai", geminiApiKey: null, openrouterApiKey: null });
    mocks.decryptApiKey.mockReturnValue("plain-key");
    mocks.credentialFindFirst.mockResolvedValue({ id: "existing" });

    const result = await migrateLegacyAiCredentials();

    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(3);
    expect(mocks.credentialCreate).not.toHaveBeenCalled();
  });
});
