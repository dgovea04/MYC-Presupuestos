import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractProjectNameFromMessage } from "./budgets";

// ─── extractProjectNameFromMessage ──────────────────────────────────────────

describe("extractProjectNameFromMessage", () => {
  it('extrae nombre después de "proyecto"', () => {
    const result = extractProjectNameFromMessage(
      "genera un presupuesto para vivienda unifamiliar en el proyecto Santa Monica",
    );
    expect(result).toBe("Santa Monica");
  });

  it('extrae nombre después de "obra"', () => {
    const result = extractProjectNameFromMessage(
      "crea presupuesto para la obra Los Olivos",
    );
    expect(result).toBe("Los Olivos");
  });

  it('extrae nombre después de "proyecto llamado"', () => {
    const result = extractProjectNameFromMessage(
      "presupuesto para el proyecto llamado Mi Casa Propia",
    );
    expect(result).toBe("Mi Casa Propia");
  });

  it('extrae nombre después de "llamado"', () => {
    const result = extractProjectNameFromMessage(
      "genera presupuesto para un proyecto llamado Edificio Central",
    );
    expect(result).toBe("Edificio Central");
  });

  it("captura nombres compuestos de múltiples palabras", () => {
    const result = extractProjectNameFromMessage(
      "en el proyecto Santa Monica de los Olivos",
    );
    // "de" funciona como delimitador porque introduce una especificación
    expect(result).toBe("Santa Monica");
  });

  it("retorna null cuando no hay mención de proyecto", () => {
    const result = extractProjectNameFromMessage(
      "genera un presupuesto para una obra de 120m2",
    );
    expect(result).toBeNull();
  });

  it("retorna null con mensaje vacío", () => {
    expect(extractProjectNameFromMessage("")).toBeNull();
  });

  it("retorna null con mensaje sin palabras clave", () => {
    const result = extractProjectNameFromMessage(
      "¿cuánto cuesta el concreto?",
    );
    expect(result).toBeNull();
  });

  it("maneja proyecto al final del mensaje sin puntuación", () => {
    const result = extractProjectNameFromMessage(
      "genera presupuesto en el proyecto Santa Monica",
    );
    expect(result).toBe("Santa Monica");
  });

  it("maneja proyecto con comillas", () => {
    const result = extractProjectNameFromMessage(
      'crea presupuesto para el proyecto "Santa Monica"',
    );
    expect(result).toBe("Santa Monica");
  });

  it("maneja proyecto seguido de punto", () => {
    const result = extractProjectNameFromMessage(
      "en el proyecto Santa Monica. También necesito",
    );
    expect(result).toBe("Santa Monica");
  });

  it("maneja proyecto seguido de coma", () => {
    const result = extractProjectNameFromMessage(
      "proyecto Santa Monica, con 2 pisos",
    );
    expect(result).toBe("Santa Monica");
  });

  // ─── Delimitadores por palabra ─────────────────────────────────────────

  it.each([
    ["en", "proyecto Santa Monica en Lima"],
    ["de", "proyecto Santa Monica de 120m2"],
    ["para", "en el proyecto Santa Monica para hacer un presupuesto"],
    ["tipo", "proyecto Santa Monica tipo vivienda unifamiliar"],
    ["área", "proyecto Santa Monica área 120m2"],
    ["metros", "en el proyecto Santa Monica metros cuadrados 120"],
    ["m²", "proyecto Santa Monica m² 120"],
    ["m2", "proyecto Santa Monica m2"],
    ["m³", "proyecto Santa Monica m³ 50"],
    ["m3", "proyecto Santa Monica m3 50"],
    ["mts", "proyecto Santa Monica mts 50"],
    ["cm²", "proyecto Santa Monica cm² 500"],
    ["cm2", "proyecto Santa Monica cm2 500"],
    ["cm³", "proyecto Santa Monica cm³ 500"],
    ["cm3", "proyecto Santa Monica cm3 500"],
    ["km", "proyecto Santa Monica km 5"],
    ["has", "proyecto Santa Monica has 2"],
  ] as const)(
    'extrae nombre cuando proyecto está seguido de "%s"',
    (_delimiter, message) => {
      const result = extractProjectNameFromMessage(message);
      expect(result).toBe("Santa Monica");
    },
  );

  it("maneja múltiples delimitadores en secuencia (de 120m2 tipo)", () => {
    const result = extractProjectNameFromMessage(
      "proyecto Santa María de 120m2 tipo vivienda",
    );
    // El lazy +? se detiene en "de" (primer delimitador), "María" queda incluido
    expect(result).toBe("Santa María");
  });

  it("es case-insensitive", () => {
    const result = extractProjectNameFromMessage(
      "en el PROYECTO SANTA MONICA",
    );
    expect(result).toBe("SANTA MONICA");
  });

  // ─── Delimitadores personalizados ─────────────────────────────────────

  it("usa delimitadores personalizados en lugar de los default", () => {
    const result = extractProjectNameFromMessage(
      "proyecto Santa Monica ubicado en Lima",
      ["ubicado"],
    );
    expect(result).toBe("Santa Monica");
  });

  it("retorna null cuando ningún delimitador personalizado coincide", () => {
    // "de" no está en la lista personalizada ["tipo"]
    const result = extractProjectNameFromMessage(
      "proyecto Santa Monica de 120m2",
      ["tipo"],
    );
    expect(result).toBe("Santa Monica de 120m2");
  });

  it("acepta lista vacía de delimitadores (solo puntuación y fin de mensaje)", () => {
    const result = extractProjectNameFromMessage(
      "proyecto Santa Monica de 120m2",
      [],
    );
    expect(result).toBe("Santa Monica de 120m2");
  });

  it("DEFAULT_DELIMITERS contiene las palabras esperadas", async () => {
    const { DEFAULT_DELIMITERS } = await import("./budgets");
    expect(DEFAULT_DELIMITERS).toContain("en");
    expect(DEFAULT_DELIMITERS).toContain("de");
    expect(DEFAULT_DELIMITERS).toContain("con");
    expect(DEFAULT_DELIMITERS).toContain("para");
    expect(DEFAULT_DELIMITERS).toContain("tipo");
    expect(DEFAULT_DELIMITERS).toContain("área");
    expect(DEFAULT_DELIMITERS).toContain("metros");
    expect(DEFAULT_DELIMITERS).toContain("mts");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateBudgetTool — Integración: resolución de projectId por nombre
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Hoisted mocks (must be before vi.mock) ──────────────────────────────────

const budgetToolMocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  budgetFindMany: vi.fn(),
  searchSimilarProjects: vi.fn(),
  searchMcpTemplateCandidates: vi.fn(),
  getCatalogPartidas: vi.fn(),
  searchSimilarPartidas: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findFirst: budgetToolMocks.projectFindFirst },
    budget: { findMany: budgetToolMocks.budgetFindMany },
  },
}));

vi.mock("@/lib/ai/budget-generation/project-similarity", () => ({
  searchSimilarProjects: budgetToolMocks.searchSimilarProjects,
}));

vi.mock("@/lib/ai/budget-generation/mcp-template-search", () => ({
  searchMcpTemplateCandidates: budgetToolMocks.searchMcpTemplateCandidates,
  MCP_TEMPLATE_STRONG_MATCH: 0.7,
}));

vi.mock("@/lib/data/partidas", () => ({
  getCatalogPartidas: budgetToolMocks.getCatalogPartidas,
}));

vi.mock("@/lib/partida-generation/similarity", () => ({
  searchSimilarPartidas: budgetToolMocks.searchSimilarPartidas,
}));

vi.mock("@/lib/ai/budget-generation/template-applicator", () => ({
  applyTemplateToSubBudget: vi.fn(),
}));

vi.mock("@/lib/ai/budget-generation/mcp-budget-preview", () => ({
  previewBudgetFromMcpTemplate: vi.fn(),
}));

vi.mock("@/lib/ai/budget-generation/mcp-budget-applicator", () => ({
  applyMcpBudgetBlueprintToProject: vi.fn(),
}));

vi.mock("@/lib/data/budget-templates", () => ({
  createUserBudgetTemplateFromBudget: vi.fn(),
  applyUserBudgetTemplateToProject: vi.fn(),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: vi.fn(),
  createBudget: vi.fn(),
}));

vi.mock("@/lib/ai/budget-generation/quantity-estimator", () => ({
  estimateQuantity: vi.fn(),
}));

// ─── Context helper ──────────────────────────────────────────────────────────

import type { AgentToolContext } from "../types";
import { generateBudgetTool, previewBudgetGenerationTool } from "./budgets";

function makeContext(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    userId: "user-1",
    executionId: "exec-integration-1",
    ...overrides,
  };
}

describe("generateBudgetTool — integración: resolución de projectId por nombre", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset implementation stacks para evitar bleed de mockResolvedValueOnce entre tests
    budgetToolMocks.projectFindFirst.mockReset();
    budgetToolMocks.budgetFindMany.mockReset();
    budgetToolMocks.searchSimilarProjects.mockReset();
    budgetToolMocks.searchMcpTemplateCandidates.mockReset();
    budgetToolMocks.getCatalogPartidas.mockReset();
    budgetToolMocks.searchSimilarPartidas.mockReset();

    // Default: flujo sin proyectos similares, sin MCP, sin catálogo
    budgetToolMocks.searchSimilarProjects.mockResolvedValue([]);
    budgetToolMocks.searchMcpTemplateCandidates.mockResolvedValue([]);
    budgetToolMocks.getCatalogPartidas.mockResolvedValue([]);
    budgetToolMocks.searchSimilarPartidas.mockReturnValue([]);
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);
    budgetToolMocks.budgetFindMany.mockResolvedValue([]);
  });

  it("extrae projectId del mensaje y resuelve el proyecto en DB", async () => {
    // El proyecto "Santa Monica" existe en la DB
    budgetToolMocks.projectFindFirst
      .mockResolvedValueOnce({ id: "proj-santa-monica", name: "Santa Monica" }) // find by name
      .mockResolvedValueOnce({ companyId: "company-1" }); // getProjectCompanyId

    // Sub-budgets existen
    budgetToolMocks.budgetFindMany
      .mockResolvedValueOnce([
        { id: "sb-1", name: "Estructuras" },
        { id: "sb-2", name: "Arquitectura" },
        { id: "sb-3", name: "Instalaciones Sanitarias" },
        { id: "sb-4", name: "Instalaciones Eléctricas" },
      ]) // primera llamada: sub-budgets
      .mockResolvedValueOnce([
        { id: "sb-1", name: "Estructuras", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-2", name: "Arquitectura", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-3", name: "Instalaciones Sanitarias", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-4", name: "Instalaciones Eléctricas", totalDirectCost: 0, _count: { items: 0 } },
      ]); // segunda llamada: resumen final

    const result = await generateBudgetTool.execute(
      { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
      makeContext({
        lastUserMessage:
          "genera un presupuesto para vivienda unifamiliar de 2 pisos, 120m2 en el proyecto Santa Monica",
      }),
    );

    // Debió resolver el projectId automáticamente
    expect(result.projectId).toBe("proj-santa-monica");

    // Verificar que buscó por nombre "Santa Monica"
    expect(budgetToolMocks.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "Santa Monica", mode: "insensitive" },
        }),
      }),
    );

    // Debió continuar el flujo: obtener sub-budgets del proyecto
    expect(budgetToolMocks.budgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-santa-monica",
          kind: "SUB_BUDGET",
        }),
      }),
    );
  });

  it("lanza error cuando el proyecto mencionado no existe en la DB", async () => {
    // projectFindFirst retorna null (proyecto no encontrado)
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      generateBudgetTool.execute(
        { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
        makeContext({
          lastUserMessage:
            "genera un presupuesto para vivienda unifamiliar de 2 pisos, 120m2 en el proyecto Santa Monica",
        }),
      ),
    ).rejects.toThrow("No se pudo determinar el proyecto");
  });

  it("usa projectId del contexto directamente cuando no se provee en input", async () => {
    // El proyecto ya está en el contexto
    const contextProjectId = "proj-contexto";

    // Sub-budgets existen
    budgetToolMocks.budgetFindMany
      .mockResolvedValueOnce([
        { id: "sb-1", name: "Estructuras" },
        { id: "sb-2", name: "Arquitectura" },
        { id: "sb-3", name: "Instalaciones Sanitarias" },
        { id: "sb-4", name: "Instalaciones Eléctricas" },
      ])
      .mockResolvedValueOnce([
        { id: "sb-1", name: "Estructuras", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-2", name: "Arquitectura", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-3", name: "Instalaciones Sanitarias", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-4", name: "Instalaciones Eléctricas", totalDirectCost: 0, _count: { items: 0 } },
      ]);

    // getProjectCompanyId
    budgetToolMocks.projectFindFirst.mockResolvedValue({ companyId: "company-1" });

    const result = await generateBudgetTool.execute(
      { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
      makeContext({
        projectId: contextProjectId,
        lastUserMessage:
          "genera un presupuesto para vivienda unifamiliar de 2 pisos, 120m2",
      }),
    );

    // Debió usar el projectId del contexto, NO buscar por nombre
    expect(result.projectId).toBe(contextProjectId);
    // extractProjectNameFromMessage no debió ejecutarse
    // (no hay llamada a project.findFirst con contains)
    const findByNameCalls = budgetToolMocks.projectFindFirst.mock.calls.filter(
      (call) => call[0]?.where?.name?.contains,
    );
    expect(findByNameCalls).toHaveLength(0);
  });

  it("lanza error cuando no hay mención de proyecto en el mensaje", async () => {
    // Mensaje sin "proyecto", "obra" ni "llamado"
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      generateBudgetTool.execute(
        { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
        makeContext({
          lastUserMessage: "genera un presupuesto para una obra de 120m2",
        }),
      ),
    ).rejects.toThrow("No se pudo determinar el proyecto");
  });

  // ─── Búsqueda en mensajes anteriores ───────────────────────────────────

  it("busca en mensajes anteriores cuando lastUserMessage no contiene nombre del proyecto", async () => {
    // Simula el flujo real: usuario primero menciona el proyecto, luego confirma sin repetir el nombre
    // El proyecto "Perez Mateos" existe en la DB
    budgetToolMocks.projectFindFirst
      .mockResolvedValueOnce({ id: "proj-perez-mateos", name: "Perez Mateos" }) // find by name desde messages
      .mockResolvedValueOnce({ companyId: "company-1" }); // getProjectCompanyId

    // Sub-budgets existen
    budgetToolMocks.budgetFindMany
      .mockResolvedValueOnce([
        { id: "sb-1", name: "Estructuras" },
        { id: "sb-2", name: "Arquitectura" },
        { id: "sb-3", name: "Instalaciones Sanitarias" },
        { id: "sb-4", name: "Instalaciones Eléctricas" },
      ])
      .mockResolvedValueOnce([
        { id: "sb-1", name: "Estructuras", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-2", name: "Arquitectura", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-3", name: "Instalaciones Sanitarias", totalDirectCost: 0, _count: { items: 0 } },
        { id: "sb-4", name: "Instalaciones Eléctricas", totalDirectCost: 0, _count: { items: 0 } },
      ]);

    const result = await generateBudgetTool.execute(
      { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
      makeContext({
        // lastUserMessage NO contiene el nombre del proyecto (simula la confirmación del usuario)
        lastUserMessage: "procede con la generacion del presupuesto",
        // messages contiene el historial completo, incluyendo el mensaje original con el proyecto
        messages: [
          { role: "user", content: "genera un presupuesto para vivienda unifamiliar de 2 pisos, 120m2 en el proyecto Perez Mateos" },
          { role: "assistant", content: "🔧 Ejecutando previewBudgetGeneration...\n  ✓ 📋 Vista previa...\n\n💭 Analizando resultados...\n\nHe generado la vista previa... ¿Deseas que proceda?" },
          { role: "user", content: "procede con la generacion del presupuesto" },
        ],
      }),
    );

    // Debió resolver el projectId desde el primer mensaje en messages
    expect(result.projectId).toBe("proj-perez-mateos");

    // Verificar que buscó por nombre "Perez Mateos" (extraído del mensaje anterior)
    expect(budgetToolMocks.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "Perez Mateos", mode: "insensitive" },
        }),
      }),
    );

    // Debió continuar el flujo: obtener sub-budgets del proyecto
    expect(budgetToolMocks.budgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-perez-mateos",
          kind: "SUB_BUDGET",
        }),
      }),
    );
  });

  it("lanza error cuando ni lastUserMessage ni mensajes anteriores contienen nombre del proyecto", async () => {
    // Solo user messages sin "proyecto", "obra" ni "llamado"
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      generateBudgetTool.execute(
        { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
        makeContext({
          lastUserMessage: "procede con la generacion",
          messages: [
            { role: "user", content: "genera un presupuesto" },
            { role: "assistant", content: "Claro, ¿para qué proyecto?" },
            { role: "user", content: "procede con la generacion" },
          ],
        }),
      ),
    ).rejects.toThrow("No se pudo determinar el proyecto");
  });

  it("solo busca en mensajes con role=user, ignorando assistant y tool messages", async () => {
    // Mensajes assistant que contienen "proyecto" NO deben ser considerados
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      generateBudgetTool.execute(
        { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto", previewOnly: false },
        makeContext({
          lastUserMessage: "procede con la generacion",
          messages: [
            { role: "assistant", content: "Usando el proyecto Perez Mateos para generar..." },
            { role: "user", content: "procede con la generacion" },
          ],
        }),
      ),
    ).rejects.toThrow("No se pudo determinar el proyecto");

    // Verificar que projectFindFirst NO fue llamado con ningún nombre de proyecto
    // (el mensaje assistant no debe activar la búsqueda)
    const findByNameCalls = budgetToolMocks.projectFindFirst.mock.calls.filter(
      (call) => call[0]?.where?.name?.contains,
    );
    expect(findByNameCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// previewBudgetGenerationTool — Integración: resolución de projectId por nombre
// ═══════════════════════════════════════════════════════════════════════════════

describe("previewBudgetGenerationTool — integración: resolución de projectId por nombre", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks
    budgetToolMocks.projectFindFirst.mockReset();
    budgetToolMocks.budgetFindMany.mockReset();
    budgetToolMocks.searchSimilarProjects.mockReset();
    budgetToolMocks.searchMcpTemplateCandidates.mockReset();
    budgetToolMocks.getCatalogPartidas.mockReset();
    budgetToolMocks.searchSimilarPartidas.mockReset();

    // Default: sin proyectos similares, sin MCP, sin catálogo
    budgetToolMocks.searchSimilarProjects.mockResolvedValue([]);
    budgetToolMocks.searchMcpTemplateCandidates.mockResolvedValue([]);
    budgetToolMocks.getCatalogPartidas.mockResolvedValue([]);
    budgetToolMocks.searchSimilarPartidas.mockReturnValue([]);
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);
    budgetToolMocks.budgetFindMany.mockResolvedValue([]);
  });

  it("busca en mensajes anteriores cuando lastUserMessage no contiene nombre del proyecto", async () => {
    // El proyecto "Perez Mateos" existe en la DB
    // projectFindFirst se llama: 1) para resolver por nombre, 2) para getProjectCompanyId
    budgetToolMocks.projectFindFirst
      .mockResolvedValueOnce({ id: "proj-perez-mateos", name: "Perez Mateos" })
      .mockResolvedValueOnce({ companyId: "company-1" });

    const result = await previewBudgetGenerationTool.execute(
      { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto" },
      makeContext({
        // lastUserMessage NO contiene el nombre del proyecto
        lastUserMessage: "procede con la generacion del presupuesto",
        // messages contiene el historial completo
        messages: [
          { role: "user", content: "genera un presupuesto para vivienda unifamiliar de 2 pisos, 120m2 en el proyecto Perez Mateos" },
          { role: "assistant", content: "🔧 Ejecutando previewBudgetGeneration...\n  ✓ 📋 Vista previa..." },
          { role: "user", content: "procede con la generacion del presupuesto" },
        ],
      }),
    );

    // Debió resolver el projectId desde el primer mensaje en messages
    expect(result.projectId).toBe("proj-perez-mateos");

    // Verificar que buscó por nombre "Perez Mateos"
    expect(budgetToolMocks.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "Perez Mateos", mode: "insensitive" },
        }),
      }),
    );

    // Debió llamar a searchSimilarProjects con el projectId resuelto
    expect(budgetToolMocks.searchSimilarProjects).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("lanza error cuando ni lastUserMessage ni mensajes anteriores contienen nombre del proyecto", async () => {
    // Solo user messages sin "proyecto", "obra" ni "llamado"
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      previewBudgetGenerationTool.execute(
        { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto" },
        makeContext({
          lastUserMessage: "procede con la generacion",
          messages: [
            { role: "user", content: "genera un presupuesto" },
            { role: "assistant", content: "¿Para qué proyecto?" },
            { role: "user", content: "procede con la generacion" },
          ],
        }),
      ),
    ).rejects.toThrow("No se pudo determinar el proyecto");
  });

  it("solo busca en mensajes con role=user, ignorando assistant y tool messages", async () => {
    // Mensajes assistant que contienen "proyecto" NO deben ser considerados
    budgetToolMocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      previewBudgetGenerationTool.execute(
        { description: "vivienda unifamiliar 2 pisos 120m2", templateSource: "auto" },
        makeContext({
          lastUserMessage: "procede con la generacion",
          messages: [
            { role: "assistant", content: "Usando el proyecto Perez Mateos para generar..." },
            { role: "user", content: "procede con la generacion" },
          ],
        }),
      ),
    ).rejects.toThrow("No se pudo determinar el proyecto");

    // Verificar que projectFindFirst NO fue llamado con ningún nombre de proyecto
    const findByNameCalls = budgetToolMocks.projectFindFirst.mock.calls.filter(
      (call) => call[0]?.where?.name?.contains,
    );
    expect(findByNameCalls).toHaveLength(0);
  });
});
