import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({
  getUserCompanies: vi.fn(),
}));

vi.mock("@/lib/data/account", () => ({
  getUserAccount: vi.fn(),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/exports/pdf", () => ({
  createBudgetPdf: vi.fn(),
}));

import { GET } from "@/app/api/reports/budget/[id]/pdf/route";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetById } from "@/lib/data/budgets";
import { getUserCompanies } from "@/lib/data/projects";
import { getUserAccount } from "@/lib/data/account";
import { getUserSettings } from "@/lib/data/settings";
import { createBudgetPdf } from "@/lib/exports/pdf";

describe("budget pdf report route", () => {
  it("passes account and company metadata into the pdf export", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getBudgetById).mockResolvedValue({
      id: "budget-1",
      project: { name: "Colegio Central", clientName: "Municipalidad", location: "Lima" },
    });
    vi.mocked(getUserSettings).mockResolvedValue({ currencyDecimals: 2 });
    vi.mocked(getUserAccount).mockResolvedValue({
      id: "user-1",
      name: "Maria Calderon",
      email: "maria@example.com",
      avatarUrl: "/uploads/avatars/user-1.png",
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
      createdAt: "2026-05-18T10:00:00.000Z",
    });
    vi.mocked(getUserCompanies).mockResolvedValue([{ name: "Constructora Andina SAC", logoUrl: "/uploads/logos/company-1.png" }]);
    vi.mocked(createBudgetPdf).mockResolvedValue(Buffer.from("pdf"));

    await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "budget-1" }) });

    expect(createBudgetPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: "budget-1" }),
      expect.objectContaining({ name: "Colegio Central" }),
      2,
      {
        companyName: "Constructora Andina SAC",
        companyLogoUrl: "/uploads/logos/company-1.png",
        name: "Maria Calderon",
        avatarUrl: "/uploads/avatars/user-1.png",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      },
    );
  });
});
