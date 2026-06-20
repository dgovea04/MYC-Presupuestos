import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/exports/centralized", () => ({
  createCentralizedExport: vi.fn(),
  createExportResponse: (result: { content: BodyInit; contentType: string; fileName: string }) =>
    new Response(result.content, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    }),
}));

vi.mock("@/lib/billing/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/entitlements")>();

  return {
    ...actual,
    assertFeatureAccess: vi.fn(),
  };
});

import { POST } from "@/app/api/exports/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { createCentralizedExport } from "@/lib/exports/centralized";

describe("central exports route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a binary export response with download headers", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(createCentralizedExport).mockResolvedValue({
      content: Buffer.from("xlsx"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: "presupuesto-budget-1.xlsx",
    });

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({
          target: "budget",
          targetId: "budget-1",
          format: "xlsx",
          preset: "presupuesto_detallado",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="presupuesto-budget-1.xlsx"');
    expect(createCentralizedExport).toHaveBeenCalledWith(
      {
        target: "budget",
        targetId: "budget-1",
        format: "xlsx",
        preset: "presupuesto_detallado",
      },
      "user-1",
    );
  });

  it("allows standard polynomial formula exports without advanced export access", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(createCentralizedExport).mockResolvedValue({
      content: Buffer.from("xlsx"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: "formula-budget-1.xlsx",
    });

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({
          target: "polynomial_formula",
          targetId: "budget-1",
          format: "xlsx",
          preset: "formula_polinomica_detallada",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });

  it("rejects unsupported export combinations with a 400 response", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(createCentralizedExport).mockRejectedValue(new Error("La combinacion de modulo, formato y preset no esta disponible"));

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({
          target: "budget",
          targetId: "budget-1",
          format: "zip",
          preset: "presupuesto_detallado",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "exports.advanced" });
    await expect(response.json()).resolves.toEqual({
      error: "La combinacion de modulo, formato y preset no esta disponible",
    });
  });
});
