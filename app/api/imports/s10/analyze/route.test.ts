import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

import { POST } from "@/app/api/imports/s10/analyze/route";
import { getAuthSession } from "@/lib/auth/session";

describe("S10 analyze route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/imports/s10/analyze", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
  });

  it("returns an import preview for uploaded .s2k files", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    const formData = new FormData();
    formData.set("file", new File([Buffer.from("SQLite format 3\u0000payload")], "obra.s2k"));

    const response = await POST(
      new Request("http://localhost/api/imports/s10/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fileName: "obra.s2k",
      status: "needs-decoder",
      analysis: {
        detectedKind: "sqlite",
      },
    });
  });

  it("rejects files without the .s2k extension", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    const formData = new FormData();
    formData.set("file", new File([Buffer.from("PK")], "obra.zip"));

    const response = await POST(
      new Request("http://localhost/api/imports/s10/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "El archivo debe tener extension .s2k." });
  });
});
