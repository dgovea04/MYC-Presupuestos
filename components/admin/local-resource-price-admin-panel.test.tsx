/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalResourcePriceAdminPanel } from "@/components/admin/local-resource-price-admin-panel";

describe("LocalResourcePriceAdminPanel", () => {
  it("does not expose editing controls to non-super-admin users", () => {
    const markup = renderToStaticMarkup(<LocalResourcePriceAdminPanel canManage={false} />);
    expect(markup).toContain("Solo el SUPER_ADMIN");
    expect(markup).not.toContain("Importar Excel");
    expect(markup).not.toContain("Crear preview manual");
  });
});
