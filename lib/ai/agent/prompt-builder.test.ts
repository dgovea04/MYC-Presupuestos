import { describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  buildDataAvailabilityPreamble,
  buildIdentitySection,
  buildWorkspaceSection,
  buildRecentProjectsSection,
  buildWorkflowSection,
  buildProjectCreationFlowSection,
  buildIntentSection,
  buildToolRulesSection,
  buildConfirmationSection,
  buildSecuritySection,
  buildResponseSection,
} from "./prompt-builder";
import type { AgentIntent, AgentPendingAction } from "./intent-router";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeIntent(overrides: Partial<AgentIntent> = {}): AgentIntent {
  return {
    type: "general_chat",
    confidence: "low",
    reason: "test",
    requiredFields: [],
    extracted: {},
    suggestedTools: [],
    ...overrides,
  };
}

// ─── Section tests ──────────────────────────────────────────────────────────

describe("buildDataAvailabilityPreamble", () => {
  it("tells the model projects are already listed", () => {
    const result = buildDataAvailabilityPreamble();
    expect(result).toContain("INFORMACIÓN YA DISPONIBLE");
    expect(result).toContain("NO LLAMES HERRAMIENTAS PARA OBTENERLA DE NUEVO");
    expect(result).toContain("PROYECTOS DISPONIBLES");
  });

  it("explicitly bans searchProjects with empty query", () => {
    const result = buildDataAvailabilityPreamble();
    expect(result).toContain("NUNCA llames searchProjects con query vacío");
    expect(result).toContain("NO llames searchProjects a menos que");
  });

  it("tells the model not to call searchCompanies for workspace", () => {
    const result = buildDataAvailabilityPreamble();
    expect(result).toContain("NO llames searchCompanies para preguntar");
  });

  it("tells model to check prompt before calling any search tool", () => {
    const result = buildDataAvailabilityPreamble();
    expect(result).toContain("VERIFICA si la información ya está en este mismo prompt");
    expect(result).toContain("NO busques lo que ya tienes");
  });
});

describe("buildIdentitySection", () => {
  it("returns the Khipu identity without encouraging tool calls", () => {
    const result = buildIdentitySection();
    expect(result).toContain("Khipu");
    expect(result).toContain("asistente técnico de construcción");
    expect(result).toContain("presupuestos de obra en Perú");
    expect(result).not.toContain("Siempre usa herramientas");
  });
});

describe("buildWorkspaceSection", () => {
  it("returns empty when no workspace", () => {
    expect(buildWorkspaceSection(null)).toBe("");
    expect(buildWorkspaceSection(undefined)).toBe("");
  });

  it("includes workspace name and ID", () => {
    const result = buildWorkspaceSection({ id: "ws-1", name: "Mi Empresa" });
    expect(result).toContain("Mi Empresa");
    expect(result).toContain("ws-1");
    expect(result).toContain("NO uses searchCompanies");
  });

  it("includes instructions not to use searchCompanies", () => {
    const result = buildWorkspaceSection({ id: "ws-1", name: "TestCo" });
    expect(result).toContain("NO uses searchCompanies para preguntar al usuario");
  });
});

describe("buildRecentProjectsSection", () => {
  it("returns empty when no projects", () => {
    expect(buildRecentProjectsSection([])).toBe("");
  });

  it("lists project names and IDs", () => {
    const result = buildRecentProjectsSection([
      { id: "proj-1", name: "Santa Monica", clientName: "Cliente A", location: "Lima" },
      { id: "proj-2", name: "Los Olivos", clientName: null, location: null },
    ]);
    expect(result).toContain("PROYECTOS DISPONIBLES");
    expect(result).toContain("Santa Monica");
    expect(result).toContain("proj-1");
    expect(result).toContain("Cliente A");
    expect(result).toContain("Lima");
    expect(result).toContain("Los Olivos");
    expect(result).toContain("proj-2");
  });
});

describe("buildWorkflowSection", () => {
  it("returns empty when no workflow", () => {
    expect(buildWorkflowSection(null)).toBe("");
  });

  it("includes bundle name, description, and goal", () => {
    const result = buildWorkflowSection({
      id: "crear-presupuesto-base",
      name: "Crear presupuesto base",
      bundleSlug: "budget-agent",
      bundleName: "Presupuestos",
      bundleDescription: "Especialista en presupuestos",
      systemPrompt: "Eres un especialista en presupuestos.",
      initialGoal: "El usuario quiere crear un presupuesto.",
    });
    expect(result).toContain("ESPECIALIDAD ACTIVA");
    expect(result).toContain("Presupuestos");
    expect(result).toContain("OBJETIVO DEL WORKFLOW");
    expect(result).toContain("El usuario quiere crear un presupuesto.");
  });
});

describe("buildProjectCreationFlowSection", () => {
  it("includes CREAR PROYECTO NUEVO flow", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain("CREAR PROYECTO NUEVO");
    expect(result).toContain("LLAMA createProject");
    expect(result).toContain("INMEDIATAMENTE");
    expect(result).toContain("REGLA DE ORO");
    expect(result).toContain("NO llames NINGUNA herramienta");
  });

  it("includes PROYECTO EXISTENTE flow", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain("PROYECTO EXISTENTE");
    expect(result).toContain("searchProjects");
    expect(result).toContain("PROYECTOS DISPONIBLES");
  });

  it("includes GENERAR PRESUPUESTO 2-step flow", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain("GENERAR PRESUPUESTO");
    expect(result).toContain("PASO 1");
    expect(result).toContain("previewBudgetGeneration");
    expect(result).toContain("PASO 2");
    expect(result).toContain("generateBudget INMEDIATAMENTE");
  });

  it("includes REGLAS IMPORTANTES", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain("REGLAS IMPORTANTES");
    expect(result).toContain("NUNCA llames searchProjects con query vacío");
    expect(result).toContain("2 veces");
    expect(result).toContain("NO llames previewBudgetGeneration ni generateBudget sin tener un projectId");
  });

  it("tells the model not to ask for optional fields", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain("No preguntes por location, clientName, projectType ni fechas");
  });

  it("includes confirmation keywords", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain('"si"');
    expect(result).toContain('"dale"');
    expect(result).toContain('"procede"');
  });

  it("asks whether to generate budget after creating a project", () => {
    const result = buildProjectCreationFlowSection();
    expect(result).toContain("¿Quieres que genere el presupuesto ahora?");
    expect(result).toContain("sigue el flujo GENERAR PRESUPUESTO");
    expect(result).toContain("confirma que el proyecto está listo");
  });
});

describe("buildIntentSection", () => {
  it("includes intent type and confidence", () => {
    const result = buildIntentSection(makeIntent({ type: "preview_budget_generation", confidence: "medium" }));
    expect(result).toContain("INTENCIÓN DETECTADA");
    expect(result).toContain("preview_budget_generation");
    expect(result).toContain("medium");
  });

  it("includes suggested tools when available", () => {
    const result = buildIntentSection(makeIntent({
      type: "preview_budget_generation",
      suggestedTools: ["previewBudgetGeneration", "createBudgetGeneral"],
    }));
    expect(result).toContain("previewBudgetGeneration");
    expect(result).toContain("createBudgetGeneral");
  });

  it("includes intent-specific rules for preview", () => {
    const result = buildIntentSection(makeIntent({ type: "preview_budget_generation" }));
    expect(result).toContain("previewBudgetGeneration");
    expect(result).toContain("NO llames previewBudgetGeneration");
    expect(result).toContain("nuevo o existente");
  });

  it("includes intent-specific rules for apply", () => {
    const result = buildIntentSection(makeIntent({ type: "apply_budget_generation" }));
    expect(result).toContain("Llama generateBudget inmediatamente");
  });
});

describe("buildToolRulesSection", () => {
  it("returns empty for general_chat", () => {
    const result = buildToolRulesSection(makeIntent({ type: "general_chat" }));
    expect(result).toBe("");
  });

  it("includes tool restrictions for preview", () => {
    const result = buildToolRulesSection(makeIntent({ type: "preview_budget_generation" }));
    expect(result).toContain("previewBudgetGeneration");
    expect(result).toContain("NUNCA");
    expect(result).toContain("searchProjects ni generateBudget");
  });

  it("includes tool restrictions for apply", () => {
    const result = buildToolRulesSection(makeIntent({ type: "apply_budget_generation" }));
    expect(result).toContain("generateBudget");
    expect(result).toContain("No necesitas previewBudgetGeneration");
  });
});

describe("buildConfirmationSection", () => {
  it("shows generic confirmation rules when no pending action", () => {
    const result = buildConfirmationSection(null);
    expect(result).toContain("CONFIRMACIÓN VÁLIDA");
    expect(result).toContain('"si"');
    expect(result).not.toContain("ACCIÓN PENDIENTE");
  });

  it("shows pending action for apply_budget_generation", () => {
    const pending: AgentPendingAction = {
      type: "apply_budget_generation",
      projectId: "proj-1",
      description: "vivienda de 120m2",
      templateSource: "auto",
    };
    const result = buildConfirmationSection(pending);
    expect(result).toContain("ACCIÓN PENDIENTE");
    expect(result).toContain("proj-1");
    expect(result).toContain("generateBudget INMEDIATAMENTE");
  });

  it("shows pending action for apply_mcp_template", () => {
    const pending: AgentPendingAction = {
      type: "apply_mcp_template",
      projectId: "proj-1",
      packageId: "pkg-123",
      description: "vivienda template",
      mode: "auto",
    };
    const result = buildConfirmationSection(pending);
    expect(result).toContain("ACCIÓN PENDIENTE");
    expect(result).toContain("pkg-123");
    expect(result).toContain("applyBudgetFromMcpTemplate");
  });
});

describe("buildSecuritySection", () => {
  it("includes key rules", () => {
    const result = buildSecuritySection();
    expect(result).toContain("NUNCA llames searchProjects con query vacío");
    expect(result).toContain("NO uses searchCompanies si ya tienes el companyId");
    expect(result).toContain("previewBudgetGeneration antes de generateBudget");
    expect(result).toContain("No dupliques Presupuesto General");
  });
});

describe("buildResponseSection", () => {
  it("includes default rules", () => {
    const result = buildResponseSection();
    expect(result).toContain("Responde en español");
    expect(result).toContain("tono profesional y técnico");
  });

  it("includes ollama-mode instructions for ollama provider", () => {
    const result = buildResponseSection("ollama");
    expect(result).toContain("MODO LOCAL");
    expect(result).toContain("Sé MÁS DIRECTO");
  });

  it("does not include ollama-mode for cloud providers", () => {
    const result = buildResponseSection("openrouter");
    expect(result).not.toContain("MODO LOCAL");
  });
});

// ─── Full prompt tests ──────────────────────────────────────────────────────

describe("buildAgentSystemPrompt", () => {
  it("builds a complete prompt with all sections", () => {
    const result = buildAgentSystemPrompt({
      intent: makeIntent({ type: "preview_budget_generation", confidence: "medium" }),
      workspace: { id: "ws-1", name: "Mi Empresa" },
      recentProjects: [{ id: "proj-1", name: "Santa Monica" }],
      workflow: null,
      provider: "openrouter",
    });

    expect(result).toContain("Khipu");
    expect(result).toContain("WORKSPACE ACTUAL");
    expect(result).toContain("PROYECTOS DISPONIBLES");
    expect(result).toContain("INSTRUCCIONES");
    expect(result).toContain("CREAR PROYECTO NUEVO");
    expect(result).toContain("INTENCIÓN DETECTADA");
    expect(result).toContain("REGLAS DE HERRAMIENTAS");
    expect(result).toContain("REGLAS DE CONFIRMACIÓN");
    expect(result).toContain("REGLAS DE SEGURIDAD");
    expect(result).toContain("REGLAS DE RESPUESTA");
    expect(result).not.toContain("MODO LOCAL");
  });

  it("includes workflow section when present", () => {
    const result = buildAgentSystemPrompt({
      intent: makeIntent(),
      workspace: null,
      recentProjects: [],
      workflow: {
        id: "wf-1",
        name: "Crear presupuesto",
        bundleSlug: "budget-agent",
        bundleName: "Presupuestos",
        bundleDescription: "Especialista",
        systemPrompt: "Eres especialista.",
        initialGoal: "Crear presupuesto.",
      },
    });

    expect(result).toContain("ESPECIALIDAD ACTIVA");
    expect(result).toContain("OBJETIVO DEL WORKFLOW");
  });

  it("includes ollama mode for ollama provider", () => {
    const result = buildAgentSystemPrompt({
      intent: makeIntent(),
      workspace: null,
      recentProjects: [],
      workflow: null,
      provider: "ollama",
    });

    expect(result).toContain("MODO LOCAL");
  });

  it("minimal prompt for general_chat has no tool rules", () => {
    const result = buildAgentSystemPrompt({
      intent: makeIntent({ type: "general_chat" }),
      workspace: null,
      recentProjects: [],
      workflow: null,
    });

    expect(result).toContain("Khipu");
    expect(result).toContain("CREAR PROYECTO NUEVO");
    expect(result).not.toContain("REGLAS DE HERRAMIENTAS");
    expect(result).toContain("REGLAS DE CONFIRMACIÓN");
    expect(result).toContain("REGLAS DE SEGURIDAD");
  });
});
