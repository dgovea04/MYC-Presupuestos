import { describe, expect, it } from "vitest";
import { AI_ROUTE_ACCESS_MATRIX, getAiCapabilityForTask } from "@/lib/ai/route-access-matrix";

describe("AI route access matrix", () => {
  it("keeps every capability tied to an explicit feature", () => {
    expect(AI_ROUTE_ACCESS_MATRIX.chat.feature).toBe("ai.chat");
    expect(AI_ROUTE_ACCESS_MATRIX.apu.feature).toBe("ai.apu");
    expect(AI_ROUTE_ACCESS_MATRIX.review.feature).toBe("ai.review");
    expect(AI_ROUTE_ACCESS_MATRIX.autocomplete.feature).toBe("ai.autocomplete");
    expect(AI_ROUTE_ACCESS_MATRIX.pdf.feature).toBe("ai.pdf");
    expect(AI_ROUTE_ACCESS_MATRIX.agent.feature).toBe("khipu.agent");
  });

  it("maps canonical tasks to their narrowest route capability", () => {
    expect(getAiCapabilityForTask("chat")).toBe("chat");
    expect(getAiCapabilityForTask("generate_apu")).toBe("apu");
    expect(getAiCapabilityForTask("review_budget")).toBe("review");
    expect(getAiCapabilityForTask("autocomplete")).toBe("autocomplete");
    expect(getAiCapabilityForTask("pdf_import_structure")).toBe("pdf");
  });
});
