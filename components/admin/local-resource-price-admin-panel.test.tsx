/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalResourcePriceAdminPanel } from "@/components/admin/local-resource-price-admin-panel";

describe("LocalResourcePriceAdminPanel", () => {
  it("shows the MFA route when a super admin has not enabled MFA", () => {
    const markup = renderToStaticMarkup(<LocalResourcePriceAdminPanel canManage mfaEnabled={false} />);
    expect(markup).toContain("Ir a Seguridad y configurar MFA");
    expect(markup).not.toContain("Forbidden");
  });

  it("does not expose editing controls to non-super-admin users", () => {
    const markup = renderToStaticMarkup(<LocalResourcePriceAdminPanel canManage={false} mfaEnabled={false} />);
    expect(markup).toContain("Solo el SUPER_ADMIN");
    expect(markup).not.toContain("Importar Excel");
    expect(markup).not.toContain("Crear preview manual");
  });
});
