import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/company", () => ({
  clearPrimaryCompanyLogo: vi.fn(),
  getPrimaryCompany: vi.fn(),
  updatePrimaryCompanyLogo: vi.fn(),
}));

vi.mock("@/lib/company/logo-storage", () => ({
  deleteStoredCompanyLogo: vi.fn(),
  storeCompanyLogoFile: vi.fn(),
}));

import { DELETE, POST } from "@/app/api/company/logo/route";
import { getAuthSession } from "@/lib/auth/session";
import { clearPrimaryCompanyLogo, getPrimaryCompany, updatePrimaryCompanyLogo } from "@/lib/data/company";
import { deleteStoredCompanyLogo, storeCompanyLogoFile } from "@/lib/company/logo-storage";

describe("company logo route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("logo", new File(["logo"], "logo.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/company/logo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(401);
  });

  it("stores a valid logo and persists the returned url", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getPrimaryCompany).mockResolvedValue({
      id: "company-1",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
      logoUrl: null,
    });
    vi.mocked(storeCompanyLogoFile).mockResolvedValue("/uploads/logos/company-1.png");
    vi.mocked(updatePrimaryCompanyLogo).mockResolvedValue({
      id: "company-1",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
      logoUrl: "/uploads/logos/company-1.png",
    });

    const formData = new FormData();
    formData.set("logo", new File(["logo"], "logo.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/company/logo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(storeCompanyLogoFile).toHaveBeenCalledWith("company-1", expect.any(File));
    expect(updatePrimaryCompanyLogo).toHaveBeenCalledWith("user-1", "/uploads/logos/company-1.png");
  });

  it("rejects invalid logo files", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getPrimaryCompany).mockResolvedValue({
      id: "company-1",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
      logoUrl: null,
    });

    const formData = new FormData();
    formData.set("logo", new File(["logo"], "logo.webp", { type: "image/webp" }));

    const response = await POST(
      new Request("http://localhost/api/company/logo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Revisa el logo seleccionado e intenta nuevamente.",
    });
  });

  it("clears the logo and removes the local file", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getPrimaryCompany).mockResolvedValue({
      id: "company-1",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
      logoUrl: "/uploads/logos/company-1.png",
    });
    vi.mocked(clearPrimaryCompanyLogo).mockResolvedValue({
      id: "company-1",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
      logoUrl: null,
    });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(deleteStoredCompanyLogo).toHaveBeenCalledWith("/uploads/logos/company-1.png");
    expect(clearPrimaryCompanyLogo).toHaveBeenCalledWith("user-1");
  });
});
