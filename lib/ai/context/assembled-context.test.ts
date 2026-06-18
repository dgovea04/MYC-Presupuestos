import { describe, expect, it, vi } from "vitest";
import { buildKhipuAssembledContext, formatAssembledContextBlock } from "@/lib/ai/context/assembled-context";

describe("Khipu assembled context", () => {
  it("loads project context, history, memory, retrieval evidence, and the user request for every task", async () => {
    const buildAiRetrievalEvidence = vi.fn().mockReturnValue([
      {
        id: "evidence-1",
        sourceType: "catalog_partida",
        title: "Concreto f'c=210",
        excerpt: "Unidad: m3. Costo unitario: PEN 420",
        score: 0.72,
        metadata: { unit: "m3" },
      },
    ]);
    const context = await buildKhipuAssembledContext({
      projectId: "project-1",
      userId: "user-1",
      task: "review_budget",
      payload: {
        budgetSummary: "Partida de concreto con costo alto",
        context: {
          route: "/projects/project-1/budgets/budget-1",
          projectId: "project-1",
          budgetId: "budget-1",
          module: "Presupuestos",
          selectedItem: "Partida de concreto",
          selectionType: "partida",
          selectionId: "partida-1",
          unit: "m3",
          currentCost: 420,
          activeTable: "presupuesto",
          viewSummary: "Partida de concreto en el presupuesto activo",
        },
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
        buildAiRetrievalEvidence,
      },
    });

    expect(context).toMatchObject({
      projectContext: "Proyecto: Hospital Norte\nCliente: MINSA",
      userRequest: {
        task: "review_budget",
        payload: expect.objectContaining({
          budgetSummary: "Partida de concreto con costo alto",
          context: expect.objectContaining({
            route: "/projects/project-1/budgets/budget-1",
            projectId: "project-1",
            budgetId: "budget-1",
            selectionType: "partida",
            viewSummary: "Partida de concreto en el presupuesto activo",
          }),
        }),
      },
    });
    expect(context.projectHistory).toHaveLength(1);
    expect(context.projectMemory).toHaveLength(1);
    expect(context.retrievalEvidence).toHaveLength(1);
    expect(context.retrievalEvidence[0]?.title).toBe("Concreto f'c=210");
    expect(buildAiRetrievalEvidence).toHaveBeenCalledWith({
      action: "review",
      query: expect.stringContaining("Partida de concreto en el presupuesto activo"),
      context: expect.objectContaining({
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        selectionType: "partida",
      }),
    });
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
          context: {
            route: "/projects/project-1/budgets/budget-1",
            projectId: "project-1",
            budgetId: "budget-1",
            module: "Presupuestos",
            selectedItem: "Partida de concreto",
            selectionType: "partida",
            selectionId: "partida-1",
            unit: "m3",
            currentCost: 420,
            activeTable: "presupuesto",
            viewSummary: "Partida de concreto en el presupuesto activo",
          },
        },
      },
    });

    expect(block).toContain("Contexto del proyecto");
    expect(block).toContain("Contexto visible del usuario");
    expect(block).toContain("Historial reciente");
    expect(block).toContain("Memoria del proyecto");
    expect(block).toContain("Fuentes consultadas");
    expect(block).toContain("Solicitud del usuario");
    expect(block).toContain("Ruta: /projects/project-1/budgets/budget-1");
    expect(block).toContain("Project ID: project-1");
    expect(block).toContain("Budget ID: budget-1");
    expect(block).toContain("Tipo de seleccion: partida");
    expect(block).toContain("Resumen visible: Partida de concreto en el presupuesto activo");
    expect(block).toContain("Proyecto usa excavadora CAT 320");
    expect(block).toContain("suggest_insumos");
  });
});
