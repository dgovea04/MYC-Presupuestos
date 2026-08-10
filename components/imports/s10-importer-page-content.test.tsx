/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { S10ImporterPageContent } from "./s10-importer-page-content";

describe("S10ImporterPageContent", () => {
  const companies = [{ id: "company-1", name: "MC SAC" }];

  it("keeps the local S10 tools available for local development", () => {
    const markup = renderToStaticMarkup(
      <S10ImporterPageContent companies={companies} localToolsEnabled />,
    );

    expect(markup).toContain("Analizador .s2k");
    expect(markup).toContain("Restaurar respaldo .S2K");
    expect(markup).toContain("SQL Server S10 local");
    expect(markup).toContain("Solo local");
    expect(markup.match(/Solo local/g)).toHaveLength(3);
    expect(markup).toContain("Draft MC");
  });

  it("shows only the online snapshot flow when local tools are disabled", () => {
    const markup = renderToStaticMarkup(
      <S10ImporterPageContent companies={companies} localToolsEnabled={false} />,
    );

    expect(markup).not.toContain("Analizador .s2k");
    expect(markup).not.toContain("Restaurar respaldo .S2K");
    expect(markup).not.toContain("SQL Server S10 local");
    expect(markup).not.toContain("Solo local");
    expect(markup).toContain("Draft MC");
    expect(markup).toContain(".json");
    expect(markup).toContain("Previsualizar");
  });
});
