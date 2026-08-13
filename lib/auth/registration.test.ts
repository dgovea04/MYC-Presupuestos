import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companyCreate: vi.fn(),
  companyFindFirst: vi.fn(),
  membershipCreate: vi.fn(),
  membershipFindFirst: vi.fn(),
  membershipUpsert: vi.fn(),
  transaction: vi.fn(),
  ensureDemoProjectForCompany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      create: mocks.companyCreate,
      findFirst: mocks.companyFindFirst,
    },
    companyMembership: {
      create: mocks.membershipCreate,
      findFirst: mocks.membershipFindFirst,
      upsert: mocks.membershipUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/onboarding/demo-project", () => ({
  ensureDemoProjectForCompany: mocks.ensureDemoProjectForCompany,
}));

import {
  ensureUserHasCompany,
  registerUserWithCompany,
  registerUserWithCompanyAndDemo,
} from "@/lib/auth/registration";

describe("ensureUserHasCompany", () => {
  beforeEach(() => {
    mocks.companyCreate.mockReset();
    mocks.companyFindFirst.mockReset();
    mocks.membershipCreate.mockReset();
    mocks.membershipFindFirst.mockReset();
    mocks.membershipUpsert.mockReset();
    mocks.transaction.mockReset();
  });

  it("returns the owned active workspace when the user already has one", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ companyId: "company-existing" });

    await expect(ensureUserHasCompany("user-1")).resolves.toBe("company-existing");

    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "ACTIVE",
        role: "OWNER",
        company: { userId: "user-1" },
      },
      orderBy: { joinedAt: "asc" },
      select: { companyId: true },
    });
    expect(mocks.companyCreate).not.toHaveBeenCalled();
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it("creates an owned company when the user only belongs to another company's workspace", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    mocks.companyFindFirst.mockResolvedValue(null);
    mocks.companyCreate.mockResolvedValue({ id: "company-owned" });
    mocks.membershipCreate.mockResolvedValue({ companyId: "company-owned" });

    await expect(
      ensureUserHasCompany("user-google", {
        name: null,
        email: "legacy04@gmail.com",
      }),
    ).resolves.toBe("company-owned");

    expect(mocks.companyCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-google",
        name: "legacy04-empresa",
      },
      select: { id: true },
    });
    expect(mocks.membershipCreate).toHaveBeenCalledWith({
      data: {
        companyId: "company-owned",
        userId: "user-google",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  });

  it("repairs a legacy company without creating a duplicate company", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    mocks.companyFindFirst.mockResolvedValue({ id: "company-legacy" });
    mocks.membershipUpsert.mockResolvedValue({ companyId: "company-legacy" });

    await expect(ensureUserHasCompany("user-1", { name: "Maria" })).resolves.toBe("company-legacy");

    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: {
        companyId_userId: {
          companyId: "company-legacy",
          userId: "user-1",
        },
      },
      update: {
        role: "OWNER",
        status: "ACTIVE",
        suspendedUntil: null,
      },
      create: {
        companyId: "company-legacy",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    expect(mocks.companyCreate).not.toHaveBeenCalled();
  });

  it("creates an initial company and owner membership for a Google user with no workspace", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    mocks.companyFindFirst.mockResolvedValue(null);
    mocks.companyCreate.mockResolvedValue({ id: "company-new" });
    mocks.membershipCreate.mockResolvedValue({ companyId: "company-new" });

    await expect(
      ensureUserHasCompany("user-google", {
        name: "Maria Calderon",
        email: "maria@gmail.com",
      }),
    ).resolves.toBe("company-new");

    expect(mocks.companyCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-google",
        name: "maria-calderon-empresa",
      },
      select: { id: true },
    });
    expect(mocks.membershipCreate).toHaveBeenCalledWith({
      data: {
        companyId: "company-new",
        userId: "user-google",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  });
});

describe("registerUserWithCompany", () => {
  beforeEach(() => {
    mocks.companyCreate.mockReset();
    mocks.companyFindFirst.mockReset();
    mocks.membershipCreate.mockReset();
    mocks.membershipFindFirst.mockReset();
    mocks.membershipUpsert.mockReset();
    mocks.transaction.mockReset();
  });

  it("creates the default company as nombre-de-usuario-empresa", async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-1", name: "Jose Alvarez", email: "jose@example.com" }),
      },
      company: {
        create: vi.fn().mockResolvedValue({ id: "company-1" }),
      },
      companyMembership: {
        create: vi.fn().mockResolvedValue({ companyId: "company-1" }),
      },
    };
    mocks.transaction.mockImplementation(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await registerUserWithCompany({
      name: "José Álvarez",
      email: "jose@example.com",
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(tx.company.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "jose-alvarez-empresa",
        ruc: null,
      },
    });
  });
});

describe("registerUserWithCompanyAndDemo", () => {
  beforeEach(() => {
    mocks.ensureDemoProjectForCompany.mockReset();
    mocks.transaction.mockReset();
  });

  it("creates user/company and then creates the onboarding demo", async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-1", name: "Maria", email: "maria@example.com" }),
      },
      company: {
        create: vi.fn().mockResolvedValue({ id: "company-1" }),
      },
      companyMembership: {
        create: vi.fn().mockResolvedValue({ companyId: "company-1" }),
      },
    };
    mocks.transaction.mockImplementation(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    mocks.ensureDemoProjectForCompany.mockResolvedValue({
      status: "created",
      projectId: "project-demo",
      generalBudgetId: "budget-demo",
      warnings: [],
    });

    const result = await registerUserWithCompanyAndDemo({
      name: "Maria",
      email: "maria@example.com",
    });

    expect(result.demoProject.status).toBe("created");
    expect(mocks.ensureDemoProjectForCompany).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      enabled: true,
    });
  });

  it("can skip demo creation explicitly", async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-1", name: "Maria", email: "maria@example.com" }),
      },
      company: {
        create: vi.fn().mockResolvedValue({ id: "company-1" }),
      },
      companyMembership: {
        create: vi.fn().mockResolvedValue({ companyId: "company-1" }),
      },
    };
    mocks.transaction.mockImplementation(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    mocks.ensureDemoProjectForCompany.mockResolvedValue({
      status: "skipped",
      projectId: null,
      generalBudgetId: null,
      warnings: [],
    });

    const result = await registerUserWithCompanyAndDemo({
      name: "Maria",
      email: "maria@example.com",
      createDemoProject: false,
    });

    expect(result.demoProject.status).toBe("skipped");
    expect(mocks.ensureDemoProjectForCompany).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      enabled: false,
    });
  });
});
