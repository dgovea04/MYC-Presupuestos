import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminPageTabs, normalizeAdminTab } from "@/components/admin/admin-page-tabs";

describe("AdminPageTabs", () => {
  it("falls back to analytics for an unknown tab", () => {
    expect(normalizeAdminTab("unknown")).toBe("analytics");
    expect(normalizeAdminTab(undefined)).toBe("analytics");
    expect(normalizeAdminTab("users")).toBe("users");
  });

  it("renders all admin areas and preserves the marketing range", () => {
    const markup = renderToStaticMarkup(
      <AdminPageTabs activeTab="billing" marketingFrom="2026-08-01" marketingTo="2026-08-07" />,
    );

    expect(markup).toContain("aria-label=\"Secciones de administración\"");
    expect(markup).toContain("aria-current=\"page\"");
    expect(markup).toContain("Analytics");
    expect(markup).toContain("IA");
    expect(markup).toContain("Usuarios");
    expect(markup).toContain("Facturación");
    expect(markup).toContain("Precios");
    expect(markup).toContain("Seguridad");
    expect(markup).toContain("Auditoría");
    expect(markup).toContain("adminTab=billing");
    expect(markup).toContain("marketingFrom=2026-08-01");
    expect(markup).toContain("marketingTo=2026-08-07");
  });
});
