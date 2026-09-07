import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KnowledgeReviewPanel } from "./knowledge-review-panel";

describe("KnowledgeReviewPanel", () => {
  it("renders candidate review controls for items and resources", () => {
    const markup = renderToStaticMarkup(<KnowledgeReviewPanel items={[{ id: "i1", name: "Excavación", scope: "GLOBAL", aliases: [] }]} resources={[{ id: "r1", name: "Cemento", scope: "GLOBAL", aliases: [{ alias: "cemento", confirmed: false }] }]} />);
    expect(markup).toContain("Partidas candidatas");
    expect(markup).toContain("Recursos candidatos");
    expect(markup).toContain("Alias para Excavación");
    expect(markup).toContain("Confirmar");
  });
});
