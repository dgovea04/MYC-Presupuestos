import { describe, expect, it, vi } from "vitest";
import { buildKhipuAssembledContext, formatAssembledContextBlock } from "@/lib/ai/context/assembled-context";

describe("Khipu assembled context", () => {
  it("loads project context, history, memory, retrieval evidence, and the user request for every task", async () => {
    const context = await buildKhipuAssembledContext({
      projectId: "project-1",
      userId: "user-1",
      task: "review_budget",
      payload: {
        budgetSummary: "Partida de concreto con costo alto",
      },
      deps: {
        getProjectContextSummary: vi.fn().mockResolvedValue("Proyecto: Hospital Norte\nCliente: MINSA"),
        getAiProjectHistory: vi.fn().mockResolvedValue([
          {
            id: "history-1",
            summary: "Revision previa",
            result: { answer: "Validar rendimiento", model: "llama3.1" },
            timestamp: "2026-06-10T10:00:00.000Z",
          },
        ]),
        getProjectAiMemory: vi.fn().mockResolvedValue([
          {
            id: "memory-1",
            memoryType: "FACT",
            fact: "Proyecto usa excavadora CAT 320",
            confidence: "0.850",
            source: "user",
            timestamp: "2026-06-11T10:00:00.000Z",
          },
        ]),
        buildAiRetrievalEvidence: vi.fn().mockReturnValue([
          {
            id: "evidence-1",
            sourceType: "catalog_partida",
            title: "Concreto f'c=210",
            excerpt: "Unidad: m3. Costo unitario: PEN 420",
            score: 0.72,
            metadata: { unit: "m3" },
          },
        ]),
      },
    });

    expect(context).toMatchObject({
      projectContext: "Proyecto: Hospital Norte\nCliente: MINSA",
      userRequest: {
        task: "review_budget",
        payload: {
          budgetSummary: "Partida de concreto con costo alto",
        },
      },
    });
    expect(context.projectHistory).toHaveLength(1);
    expect(context.projectMemory).toHaveLength(1);
    expect(context.retrievalEvidence).toHaveLength(1);
  });

  it("formats a stable context block for prompts", async () => {
    const block = formatAssembledContextBlock({
      projectContext: "Proyecto: Hospital Norte",
      projectHistory: [
        {
          id: "history-1",
          summary: "Revision previa",
          result: { answer: "Validar rendimiento", model: "llama3.1" },
          timestamp: "2026-06-10T10:00:00.000Z",
        },
      ],
      projectMemory: [
        {
          id: "memory-1",
          projectId: "project-1",
          memoryType: "FACT",
          fact: "Proyecto usa excavadora CAT 320",
          confidence: "0.850",
          source: "user",
          timestamp: "2026-06-11T10:00:00.000Z",
        },
      ],
      retrievalEvidence: [
        {
          id: "evidence-1",
          sourceType: "catalog_resource",
          title: "Cemento Portland",
          excerpt: "Unidad: bolsa",
          score: 0.64,
          metadata: {},
        },
      ],
      userRequest: {
        task: "suggest_insumos",
        payload: {
          description: "Concreto f'c=210",
        },
      },
    });

    expect(block).toContain("Contexto del proyecto");
    expect(block).toContain("Historial reciente");
    expect(block).toContain("Memoria del proyecto");
    expect(block).toContain("Fuentes consultadas");
    expect(block).toContain("Solicitud del usuario");
    expect(block).toContain("Proyecto usa excavadora CAT 320");
    expect(block).toContain("suggest_insumos");
  });
});
