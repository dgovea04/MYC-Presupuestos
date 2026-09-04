/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DbImporterPageContent } from "./db-importer-page-content";

describe("DbImporterPageContent", () => {
  const companies = [{ id: "company-1", name: "MC SAC" }];

  it("renders upload mode with the supported SQLite extensions", () => {
    const markup = renderToStaticMarkup(
      <DbImporterPageContent companies={companies} localToolsEnabled />,
    );

    expect(markup).toContain("Archivo de presupuesto SQLite (.db)");
    expect(markup).toContain('accept=".db,.sqlite,.sqlite3"');
    expect(markup).toContain("Subir archivo");
    expect(markup).toContain("Buscar base local");
    expect(markup).toContain("MC SAC");
  });

  it("explains the local limitation when local tools are disabled", () => {
    const markup = renderToStaticMarkup(
      <DbImporterPageContent companies={companies} localToolsEnabled={false} />,
    );

    expect(markup).toContain("La lectura por ruta local solo esta disponible");
    expect(markup).toContain("Usa Subir archivo en una instalacion web");
    expect(markup).toContain('disabled=""');
  });

  it("disables import controls when no company exists", () => {
    const markup = renderToStaticMarkup(
      <DbImporterPageContent companies={[]} localToolsEnabled />,
    );

    expect(markup).toContain("Crea una empresa antes de importar proyectos .db.");
    expect(markup).toContain("Sin empresas");
    expect(markup).toContain('disabled=""');
  });
});
