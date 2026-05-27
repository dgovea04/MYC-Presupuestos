import { describe, expect, it, vi } from "vitest";

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

import { POST } from "@/app/api/exports/route";
import { getAuthSession } from "@/lib/auth/session";
import { createCentralizedExport } from "@/lib/exports/centralized";

describe("central exports route", () => {
  it("returns a binary export response with download headers", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
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

  it("rejects unsupported export combinations with a 400 response", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
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
    await expect(response.json()).resolves.toEqual({
      error: "La combinacion de modulo, formato y preset no esta disponible",
    });
  });
});
