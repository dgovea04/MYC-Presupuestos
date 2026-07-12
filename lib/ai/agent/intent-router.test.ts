import { describe, expect, it } from "vitest";
import { detectAgentIntent, type AgentPendingAction } from "./intent-router";

describe("detectAgentIntent", () => {
  describe("general_chat", () => {
    it("detects generic messages as general_chat", () => {
      const intent = detectAgentIntent({ message: "Hola, ¿cómo estás?" });
      expect(intent.type).toBe("general_chat");
      expect(intent.confidence).toBe("low");
    });

    it("detects gratitude as general_chat", () => {
      const intent = detectAgentIntent({ message: "Gracias por tu ayuda" });
      expect(intent.type).toBe("general_chat");
    });
  });

  describe("preview_budget_generation", () => {
    it.each([
      "generar presupuesto para vivienda de 120m2",
      "crea un presupuesto para edificio de 5 pisos",
      "crear un presupuesto con partidas",
      "presupuesto para hospital en Lima",
      "cotiza una obra de carretera",
      "haz un presupuesto para colegio",
    ])('detects "%s" as preview_budget_generation', (msg) => {
      const intent = detectAgentIntent({ message: msg });
      expect(intent.type).toBe("preview_budget_generation");
      expect(intent.suggestedTools).toContain("previewBudgetGeneration");
    });

    it("extracts projectType from description", () => {
      const intent = detectAgentIntent({ message: "generar presupuesto para vivienda de 120m2" });
      expect(intent.extracted.projectType).toBe("vivienda");
    });

    it("sets templateSource to auto by default", () => {
      const intent = detectAgentIntent({ message: "generar presupuesto para edificio" });
      expect(intent.extracted.templateSource).toBe("auto");
    });
  });

  describe("with pending action + confirmation", () => {
    const pendingAction: AgentPendingAction = {
      type: "apply_budget_generation",
      projectId: "project-1",
      description: "vivienda de 120m2",
      templateSource: "auto",
    };

    it("routes 'si' to apply_budget_generation when there is a pending action", () => {
      const intent = detectAgentIntent({
        message: "si",
        pendingAction,
        projectId: "project-1",
      });
      expect(intent.type).toBe("apply_budget_generation");
      expect(intent.suggestedTools).toContain("generateBudget");
      expect(intent.extracted.projectId).toBe("project-1");
    });

    it("routes 'dale' to apply_budget_generation", () => {
      const intent = detectAgentIntent({
        message: "dale",
        pendingAction,
        projectId: "project-1",
      });
      expect(intent.type).toBe("apply_budget_generation");
    });

    it("routes 'no' to general_chat when there is a pending action", () => {
      const intent = detectAgentIntent({
        message: "no",
        pendingAction,
        projectId: "project-1",
      });
      expect(intent.type).toBe("general_chat");
    });

    it("routes modification requests to preview_budget_generation", () => {
      const intent = detectAgentIntent({
        message: "cambia el área a 200m2",
        pendingAction,
        projectId: "project-1",
      });
      expect(intent.type).toBe("preview_budget_generation");
    });
  });

  describe("with MCP pending action", () => {
    const mcpPending: AgentPendingAction = {
      type: "apply_mcp_template",
      projectId: "project-1",
      packageId: "pkg-123",
      description: "vivienda template",
      mode: "auto",
    };

    it("routes 'si' to apply_mcp_template", () => {
      const intent = detectAgentIntent({
        message: "sí",
        pendingAction: mcpPending,
        projectId: "project-1",
      });
      expect(intent.type).toBe("apply_mcp_template");
      expect(intent.suggestedTools).toContain("applyBudgetFromMcpTemplate");
    });
  });

  describe("search_mcp_template", () => {
    it.each([
      "buscar plantilla mcp de vivienda",
      "usa un .mcp",
      "buscar mcp para hospital",
    ])('detects "%s" as search_mcp_template', (msg) => {
      const intent = detectAgentIntent({ message: msg });
      expect(intent.type).toBe("search_mcp_template");
      expect(intent.suggestedTools).toContain("searchMcpTemplates");
    });

    it("sets templateSource to mcp", () => {
      const intent = detectAgentIntent({ message: "buscar plantilla mcp de vivienda" });
      expect(intent.extracted.templateSource).toBe("mcp");
    });
  });

  describe("create_general_budget", () => {
    it("detects 'crear presupuesto general'", () => {
      const intent = detectAgentIntent({ message: "crear presupuesto general" });
      expect(intent.type).toBe("create_general_budget");
    });

    it("requires projectId when not provided", () => {
      const intent = detectAgentIntent({ message: "crear presupuesto general" });
      expect(intent.requiredFields.some((f) => f.field === "projectId")).toBe(true);
    });

    it("does not require projectId when provided", () => {
      const intent = detectAgentIntent({ message: "crear presupuesto general", projectId: "proj-1" });
      expect(intent.requiredFields.some((f) => f.field === "projectId")).toBe(false);
    });
  });

  describe("create_sub_budget", () => {
    it("detects 'crear subpresupuesto'", () => {
      const intent = detectAgentIntent({ message: "crear un subpresupuesto de instalaciones" });
      expect(intent.type).toBe("create_sub_budget");
    });
  });

  describe("create_project", () => {
    it("detects 'crear proyecto'", () => {
      const intent = detectAgentIntent({ message: "crear un nuevo proyecto" });
      expect(intent.type).toBe("create_project");
      expect(intent.suggestedTools).toContain("createProject");
    });
  });

  describe("select_existing_project", () => {
    it("detects 'trabajar en proyecto'", () => {
      const intent = detectAgentIntent({ message: "quiero trabajar en el proyecto Santa Monica" });
      expect(intent.type).toBe("select_existing_project");
    });
  });

  describe("review_apu", () => {
    it("detects 'revisar apu'", () => {
      const intent = detectAgentIntent({ message: "revisar el apu de concreto" });
      expect(intent.type).toBe("review_apu");
    });
  });

  describe("optimize_apu", () => {
    it("detects 'optimizar apu'", () => {
      const intent = detectAgentIntent({ message: "optimizar el apu para reducir costos" });
      expect(intent.type).toBe("optimize_apu");
    });
  });

  describe("export_report", () => {
    it("detects 'exportar a pdf'", () => {
      const intent = detectAgentIntent({ message: "exportar el presupuesto a pdf" });
      expect(intent.type).toBe("export_report");
      expect(intent.extracted.reportFormat).toBe("pdf");
    });

    it("detects 'exportar a excel'", () => {
      const intent = detectAgentIntent({ message: "exportar a excel" });
      expect(intent.type).toBe("export_report");
      expect(intent.extracted.reportFormat).toBe("excel");
    });
  });

  describe("keyword priority", () => {
    it("MCP keywords take priority over budget generation", () => {
      const intent = detectAgentIntent({ message: "buscar un mcp de vivienda de 120m2" });
      expect(intent.type).toBe("search_mcp_template");
    });

    it("presupuesto general takes priority over preview", () => {
      const intent = detectAgentIntent({ message: "crear presupuesto general para el proyecto" });
      expect(intent.type).toBe("create_general_budget");
    });
  });

  describe("extracted fields", () => {
    it("extracts reportFormat pdf", () => {
      const intent = detectAgentIntent({ message: "exportar a pdf" });
      expect(intent.extracted.reportFormat).toBe("pdf");
    });

    it("extracts reportFormat excel", () => {
      const intent = detectAgentIntent({ message: "descargar excel del presupuesto" });
      expect(intent.extracted.reportFormat).toBe("excel");
    });

    it("extracts reportFormat s10", () => {
      const intent = detectAgentIntent({ message: "exportar s10" });
      expect(intent.extracted.reportFormat).toBe("s10");
    });

    it("extracts projectName from message", () => {
      const intent = detectAgentIntent({ message: "trabajar en el proyecto Santa Monica" });
      expect(intent.extracted.projectName).toBe("santa monica");
    });
  });
});
