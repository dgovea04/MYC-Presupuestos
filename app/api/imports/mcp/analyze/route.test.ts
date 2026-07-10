import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

import { POST } from "@/app/api/imports/mcp/analyze/route";
import { getAuthSession } from "@/lib/auth/session";
import { buildMinimalProjectPackageBuffer } from "@/lib/mcp/fixtures/minimal-project-package";

describe("MCP analyze route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/imports/mcp/analyze", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
  });

  it("rejects requests without a file", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    // Send a plain POST without multipart body; formData() returns empty FormData
    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", { method: "POST" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Adjunta un archivo .mcp para analizar." });
  });

  it("rejects files without the .mcp extension", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const formData = new FormData();
    formData.set("file", new File([Buffer.from("not-a-package")], "obra.zip"));

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "El archivo debe tener extension .mcp." });
  });

  it("rejects oversized files", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const formData = new FormData();
    const bigFile = new File([Buffer.alloc(41 * 1024 * 1024 + 1)], "oversized.mcp");
    formData.set("file", bigFile);

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "El archivo .mcp supera el limite de 40 MB para analisis.",
    });
  });

  it("returns a preview for a valid .mcp file", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const buffer = buildMinimalProjectPackageBuffer();
    const formData = new FormData();
    formData.set("file", new File([buffer], "proyecto-de-prueba.mcp"));

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(["supported", "supported_with_warnings"]).toContain(body.compatibility);
    expect(body.projectName).toBe("Proyecto de prueba");
    expect(body.formatVersion).toBe("1.0.0");
    expect(body.sourceApp).toBe("MC Presupuestos");
    expect(body.modules).toBeInstanceOf(Array);
    expect(body.modules.length).toBeGreaterThan(0);
  });

  it("returns fileEntries in the preview response", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const buffer = buildMinimalProjectPackageBuffer();
    const formData = new FormData();
    formData.set("file", new File([buffer], "proyecto-de-prueba.mcp"));

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fileEntries).toBeDefined();
    expect(body.fileEntries["manifest.json"]).toBeTruthy();
  });

  it("rejects an empty .mcp file", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const formData = new FormData();
    formData.set("file", new File([Buffer.alloc(10)], "vacio.mcp"));

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a .mcp file with a tampered manifest", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const buffer = buildMinimalProjectPackageBuffer();
    // Corrupt bytes deep in the buffer to break the manifest structure
    const corrupted = Buffer.from(buffer);
    if (corrupted.length > 150) {
      // Corrupt the JSON content of manifest.json by flipping a byte deep in the content
      corrupted[120] = corrupted[120] === 65 ? 66 : 65;
    }
    const formData = new FormData();
    formData.set("file", new File([corrupted], "corrupt.mcp"));

    const response = await POST(
      new Request("http://localhost/api/imports/mcp/analyze", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
  });
});
