import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/ai/context/assembled-context", () => ({
  formatAssembledContextBlock: () => "",
}));

import { buildSkillProviderRequest } from "./registry";

describe("pdf import skill registry", () => {
  it("builds json-only messages for PDF import structure tasks", () => {
    const request = buildSkillProviderRequest({
      task: "pdf_import_structure",
      userId: "user-1",
      payload: { prompt: "Estructura presupuesto.pdf como JSON valido" },
      assembledContext: {
        projectContext: "",
        projectHistory: [],
        projectMemory: [],
        retrievalEvidence: [],
        userRequest: { task: "pdf_import_structure", payload: {} },
      },
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("pdf_import_structure_v1");
    expect(content).toContain("Responde unicamente con JSON valido");
    expect(content).toContain("Estructura presupuesto.pdf");
  });
});
