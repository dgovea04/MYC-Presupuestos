import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
}));

import { PATCH } from "@/app/api/settings/route";
import { getAuthSession } from "@/lib/auth/session";
import { updateUserSettings } from "@/lib/data/settings";

describe("settings route copy", () => {
  it("returns the accented save error message when persistence fails", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(updateUserSettings).mockRejectedValue(new Error("db failed"));

    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No se pudo guardar la configuración",
    });
  });

  it("returns the accented validation error message for invalid payloads", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCurrency: "PEN",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Revisa los datos de configuración e intenta nuevamente.",
    });
  });
});
