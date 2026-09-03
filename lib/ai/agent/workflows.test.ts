import { describe, expect, it } from "vitest";
import {
  SPECIALIST_BUNDLES,
  WORKFLOW_TEMPLATES,
  getBundleBySlug,
  getWorkflowTemplate,
  getToolsForBundle,
  getBundleSystemPrompt,
} from "./workflows";

// ─── Shared helper ───────────────────────────────────────────────────────────
// Extrae palabras camelCase de un texto que coincidan con toolNames conocidos.
// Ej: "usa searchCompanies y createProject" → ["searchCompanies", "createProject"]

function extractKnownToolNames(text: string, knownToolNames: Set<string>): string[] {
  const camelCaseWords = text.match(/[a-z]+[A-Z][a-zA-Z]*/g) ?? [];
  return [...new Set(camelCaseWords.filter((word) => knownToolNames.has(word)))];
}

function collectAllToolNames(): Set<string> {
  const all = new Set<string>();
  for (const bundle of SPECIALIST_BUNDLES) {
    for (const name of bundle.toolNames) {
      all.add(name);
    }
  }
  return all;
}

// ─── Specialist Bundles ─────────────────────────────────────────────────────

describe("SpecialistBundles", () => {
  it("tiene 7 bundles definidos (khipu-agent + 6 especialistas)", () => {
    expect(SPECIALIST_BUNDLES).toHaveLength(7);
  });

  it("cada bundle tiene slug, name, description, icon, toolNames y systemPrompt", () => {
    for (const bundle of SPECIALIST_BUNDLES) {
      expect(bundle.slug).toBeTruthy();
      expect(bundle.name).toBeTruthy();
      expect(bundle.description).toBeTruthy();
      expect(bundle.icon).toBeTruthy();
      expect(Array.isArray(bundle.toolNames)).toBe(true);
      expect(bundle.toolNames.length).toBeGreaterThan(0);
      expect(bundle.systemPrompt).toBeTruthy();
    }
  });

  it("cada bundle tiene slugs únicos", () => {
    const slugs = SPECIALIST_BUNDLES.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("khipu-agent tiene herramientas de todos los dominios", () => {
    const bundle = getBundleBySlug("khipu-agent");
    expect(bundle).toBeDefined();
    // Proyectos
    expect(bundle!.toolNames).toContain("searchCompanies");
    expect(bundle!.toolNames).toContain("createProject");
    // Presupuestos
    expect(bundle!.toolNames).toContain("createBudget");
    expect(bundle!.toolNames).toContain("createBudgetGeneral");
    // Preview y MCP
    expect(bundle!.toolNames).toContain("previewBudgetGeneration");
    expect(bundle!.toolNames).toContain("searchMcpTemplates");
    expect(bundle!.toolNames).toContain("previewBudgetFromMcpTemplate");
    expect(bundle!.toolNames).toContain("applyBudgetFromMcpTemplate");
    // Partidas
    expect(bundle!.toolNames).toContain("searchPartidas");
    // APU
    expect(bundle!.toolNames).toContain("calculateAPU");
    expect(bundle!.toolNames).toContain("reviewAPU");
    // Insumos
    expect(bundle!.toolNames).toContain("searchInsumos");
    // Cronograma
    expect(bundle!.toolNames).toContain("createSchedule");
    expect(bundle!.toolNames).toContain("calculateCriticalPath");
    // Metrados
    expect(bundle!.toolNames).toContain("createTakeoff");
    // Reportes
    expect(bundle!.toolNames).toContain("exportPDF");
    expect(bundle!.toolNames).toContain("dashboard");
  });

  it("budget-agent tiene herramientas de presupuestos, partidas, capítulos, MCP e insumos", () => {
    const bundle = getBundleBySlug("budget-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.toolNames).toContain("createBudget");
    expect(bundle!.toolNames).toContain("searchPartidas");
    expect(bundle!.toolNames).toContain("createChapter");
    expect(bundle!.toolNames).toContain("addInsumo");
    expect(bundle!.toolNames).toContain("exportPDF");
    // MCP tools
    expect(bundle!.toolNames).toContain("previewBudgetGeneration");
    expect(bundle!.toolNames).toContain("searchMcpTemplates");
    expect(bundle!.toolNames).toContain("previewBudgetFromMcpTemplate");
    expect(bundle!.toolNames).toContain("applyBudgetFromMcpTemplate");
  });

  it("apu-agent tiene herramientas de APU, búsqueda y cálculo", () => {
    const bundle = getBundleBySlug("apu-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.toolNames).toContain("calculateAPU");
    expect(bundle!.toolNames).toContain("reviewAPU");
    expect(bundle!.toolNames).toContain("createAPU");
    expect(bundle!.toolNames).toContain("optimizeAPU");
    expect(bundle!.toolNames).toContain("searchPartidas");
    expect(bundle!.toolNames).toContain("searchInsumos");
  });

  it("planning-agent tiene herramientas de cronograma y metrados", () => {
    const bundle = getBundleBySlug("planning-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.toolNames).toContain("createSchedule");
    expect(bundle!.toolNames).toContain("updateTask");
    expect(bundle!.toolNames).toContain("linkPredecessor");
    expect(bundle!.toolNames).toContain("calculateCriticalPath");
    expect(bundle!.toolNames).toContain("reviewTakeoff");
    expect(bundle!.toolNames).toContain("createTakeoff");
  });

  it("review-agent solo tiene herramientas de lectura", () => {
    const bundle = getBundleBySlug("review-agent");
    expect(bundle).toBeDefined();
    // Todas las tools del bundle deben ser read, excepto calculateBudget que también es read
    const readOnlyNames = ["reviewAPU", "reviewTakeoff", "compareBudgets",
      "searchPartidas", "searchBudgets", "searchInsumos",
      "calculateBudget", "calculateAPU", "getReviewSummary", "listReviewFindings",
      "getReviewFinding", "getReviewEvidence", "calculateReviewFindingImpact"];
    for (const name of bundle!.toolNames) {
      expect(readOnlyNames).toContain(name);
    }
  });

  it("reporting-agent tiene herramientas de exportación y dashboard", () => {
    const bundle = getBundleBySlug("reporting-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.toolNames).toContain("exportPDF");
    expect(bundle!.toolNames).toContain("exportExcel");
    expect(bundle!.toolNames).toContain("exportS10");
    expect(bundle!.toolNames).toContain("dashboard");
    expect(bundle!.toolNames).toContain("calculateBudget");
  });

  it("registers risk specialist workflow", () => {
    const bundle = getBundleBySlug("risk-agent");
    const workflow = getWorkflowTemplate("analizar-riesgo-monte-carlo");

    expect(bundle?.toolNames).toContain("suggestRiskVariables");
    expect(bundle?.toolNames).toContain("runRiskSimulation");
    expect(workflow?.bundleSlug).toBe("risk-agent");
  });

  describe("consistencia systemPrompt con toolNames", () => {
    it("cada bundle que menciona toolNames explícitos en su systemPrompt los tiene registrados en toolNames", () => {
      const allKnownTools = collectAllToolNames();
      const bundlesWithoutExplicitTools = ["review-agent"];

      for (const bundle of SPECIALIST_BUNDLES) {
        const mentionedTools = extractKnownToolNames(bundle.systemPrompt, allKnownTools);

        if (bundlesWithoutExplicitTools.includes(bundle.slug)) {
          expect(
            mentionedTools,
            `Bundle "${bundle.slug}" usa lenguaje natural sin toolNames explícitos`,
          ).toHaveLength(0);
        } else {
          expect(
            mentionedTools.length,
            `Bundle "${bundle.slug}" debería mencionar al menos un toolName explícito en su systemPrompt`,
          ).toBeGreaterThan(0);

          const bundleTools = new Set(bundle.toolNames);
          const missingTools = mentionedTools.filter((tool) => !bundleTools.has(tool));

          expect(
            missingTools,
            `Bundle "${bundle.slug}" menciona herramientas en systemPrompt que no están en toolNames: ${missingTools.join(", ")}`,
          ).toEqual([]);
        }
      }
    });

    it("budget-agent mentiona calculateBudget en su systemPrompt", () => {
      const prompt = getBundleSystemPrompt("budget-agent");
      expect(prompt).toContain("calculateBudget");
    });

    it("apu-agent mentiona searchPartidas, searchInsumos y calculateAPU en su systemPrompt", () => {
      const prompt = getBundleSystemPrompt("apu-agent");
      expect(prompt).toContain("searchPartidas");
      expect(prompt).toContain("searchInsumos");
      expect(prompt).toContain("calculateAPU");
    });

    it("planning-agent mentiona calculateCriticalPath, updateTask y linkPredecessor en su systemPrompt", () => {
      const prompt = getBundleSystemPrompt("planning-agent");
      expect(prompt).toContain("calculateCriticalPath");
      expect(prompt).toContain("updateTask");
      expect(prompt).toContain("linkPredecessor");
    });

    it("reporting-agent mentiona calculateBudget en camelCase y el resto en lenguaje natural", () => {
      const prompt = getBundleSystemPrompt("reporting-agent");
      expect(prompt).toContain("calculateBudget");
      // "Puedes exportar presupuestos a PDF, Excel y formato S10"
      expect(prompt).toContain("PDF");
      expect(prompt).toContain("Excel");
      expect(prompt).toContain("S10");
      expect(prompt).toContain("dashboards");
    });

    it("khipu-agent y review-agent usan lenguaje natural con pocos toolNames explícitos", () => {
      const allKnownTools = collectAllToolNames();
      // khipu-agent now mentions previewBudgetGeneration and generateBudget in its systemPrompt
      const khipuMentions = extractKnownToolNames(getBundleSystemPrompt("khipu-agent")!, allKnownTools);
      expect(khipuMentions).toContain("previewBudgetGeneration");
      expect(khipuMentions).toContain("generateBudget");
      // review-agent still uses pure natural language
      expect(extractKnownToolNames(getBundleSystemPrompt("review-agent")!, allKnownTools)).toHaveLength(0);
    });
  });
});

// ─── Workflow Templates ──────────────────────────────────────────────────────

describe("WorkflowTemplates", () => {
  it("tiene 9 templates definidos", () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(9);
  });

  it("cada template tiene slug, name, description, bundleSlug, initialGoal y defaultMode", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      expect(template.slug).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.bundleSlug).toBeTruthy();
      expect(template.initialGoal).toBeTruthy();
      expect(["chat", "goal", "workflow"]).toContain(template.defaultMode);
    }
  });

  it("cada template tiene un bundleSlug que corresponde a un bundle existente", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const bundle = getBundleBySlug(template.bundleSlug);
      expect(bundle).toBeDefined();
      expect(bundle!.slug).toBe(template.bundleSlug);
    }
  });

  it("cada template tiene slugs únicos", () => {
    const slugs = WORKFLOW_TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // ─── Tests específicos para crear-proyecto-desde-cero ───────────────────

  it("tiene el template crear-proyecto-desde-cero definido", () => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.slug === "crear-proyecto-desde-cero");
    expect(template).toBeDefined();
  });

  it("crear-proyecto-desde-cero tiene nombre, descripción y bundleSlug correctos", () => {
    const template = getWorkflowTemplate("crear-proyecto-desde-cero");
    expect(template).toBeDefined();
    expect(template!.name).toBe("Crear proyecto desde cero");
    expect(template!.description).toContain("sin agregar partidas");
    expect(template!.bundleSlug).toBe("budget-agent");
    expect(template!.defaultMode).toBe("goal");
  });

    it("crear-proyecto-desde-cero tiene un initialGoal que menciona searchCompanies y createProject", () => {
    const template = getWorkflowTemplate("crear-proyecto-desde-cero");
    expect(template).toBeDefined();
    expect(template!.initialGoal).toContain("searchCompanies");
    expect(template!.initialGoal).toContain("createProject");
    expect(template!.initialGoal).toContain("estructura base");
  });

  it("crear-proyecto-desde-cero indica que NO se deben agregar partidas ni APUs", () => {
    const template = getWorkflowTemplate("crear-proyecto-desde-cero");
    expect(template).toBeDefined();
    expect(template!.initialGoal).toContain("sin agregar capítulos, partidas ni APUs");
  });

  it("crear-proyecto-desde-cero menciona la estructura base del proyecto", () => {
    const template = getWorkflowTemplate("crear-proyecto-desde-cero");
    expect(template).toBeDefined();
    expect(template!.initialGoal).toContain("estructura base");
  });

  it("budget-agent (bundle de crear-proyecto-desde-cero) tiene searchCompanies y createProject", () => {
    const bundle = getBundleBySlug("budget-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.toolNames).toContain("searchCompanies");
    expect(bundle!.toolNames).toContain("createProject");
  });

  it("getWorkflowTemplate retorna crear-proyecto-desde-cero", () => {
    const template = getWorkflowTemplate("crear-proyecto-desde-cero");
    expect(template).toBeDefined();
    expect(template!.slug).toBe("crear-proyecto-desde-cero");
    expect(template!.name).toBe("Crear proyecto desde cero");
  });

  // ─── Tests específicos para asistente-general ───────────────────────────

  it("tiene el template asistente-general definido", () => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.slug === "asistente-general");
    expect(template).toBeDefined();
  });

  it("asistente-general tiene nombre, bundleSlug y defaultMode correctos", () => {
    const template = getWorkflowTemplate("asistente-general");
    expect(template).toBeDefined();
    expect(template!.name).toBe("Asistente general");
    expect(template!.bundleSlug).toBe("khipu-agent");
    expect(template!.defaultMode).toBe("chat");
  });

  it("asistente-general tiene un initialGoal que menciona searchCompanies y createProject", () => {
    const template = getWorkflowTemplate("asistente-general");
    expect(template).toBeDefined();
    expect(template!.initialGoal).toContain("searchCompanies");
    expect(template!.initialGoal).toContain("createProject");
  });

  it("asistente-general tiene una description que menciona creación de proyectos", () => {
    const template = getWorkflowTemplate("asistente-general");
    expect(template).toBeDefined();
    expect(template!.description).toContain("crea proyectos");
  });

  it("khipu-agent (bundle de asistente-general) tiene searchCompanies y createProject", () => {
    const bundle = getBundleBySlug("khipu-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.toolNames).toContain("searchCompanies");
    expect(bundle!.toolNames).toContain("createProject");
  });

  it("getWorkflowTemplate retorna asistente-general", () => {
    const template = getWorkflowTemplate("asistente-general");
    expect(template).toBeDefined();
    expect(template!.slug).toBe("asistente-general");
    expect(template!.name).toBe("Asistente general");
  });

  // ─── Consistencia bundle-template ────────────────────────────────────────

  describe("consistencia entre templates y bundles", () => {
    it("extrae herramientas del initialGoal correctamente", () => {
      const known = new Set(["searchCompanies", "createProject", "reviewAPU", "calculateAPU"]);
      const result = extractKnownToolNames(
        "Usa searchCompanies y createProject para crear. Luego reviewAPU.",
        known,
      );
      expect(result).toEqual(["searchCompanies", "createProject", "reviewAPU"]);
    });

    it("no extrae palabras que no son toolNames conocidos", () => {
      const known = new Set(["createBudget"]);
      const result = extractKnownToolNames(
        "Crea un presupuesto usando createBudget. También usa calculateBudget si es necesario.",
        known,
      );
      // calculateBudget no está en known, no debería aparecer
      expect(result).toEqual(["createBudget"]);
    });

    it("cada template menciona solo herramientas que existen en su bundle asociado", () => {
      const allKnownTools = collectAllToolNames();

      for (const template of WORKFLOW_TEMPLATES) {
        const bundle = getBundleBySlug(template.bundleSlug);
        expect(bundle).toBeDefined();

        const mentionedTools = extractKnownToolNames(template.initialGoal, allKnownTools);
        const bundleTools = new Set(bundle!.toolNames);

        const missingTools = mentionedTools.filter((tool) => !bundleTools.has(tool));

        expect(
          missingTools,
          `Template "${template.slug}" menciona herramientas que no están en el bundle "${template.bundleSlug}": ${missingTools.join(", ")}`,
        ).toEqual([]);
      }
    });

    it("cada template menciona al menos una herramienta de su bundle (salvo asistente-general)", () => {
      const allKnownTools = collectAllToolNames();

      for (const template of WORKFLOW_TEMPLATES) {
        if (template.slug === "asistente-general") continue;

        const bundle = getBundleBySlug(template.bundleSlug);
        expect(bundle).toBeDefined();

        const mentionedTools = extractKnownToolNames(template.initialGoal, allKnownTools);

        expect(
          mentionedTools.length,
          `Template "${template.slug}" no menciona ninguna herramienta conocida de su bundle "${template.bundleSlug}" en el initialGoal`,
        ).toBeGreaterThan(0);
      }
    });
  });
});

// ─── Helper Functions ────────────────────────────────────────────────────────

describe("getBundleBySlug", () => {
  it("retorna bundle existente", () => {
    const bundle = getBundleBySlug("budget-agent");
    expect(bundle).toBeDefined();
    expect(bundle!.name).toBe("Presupuestos");
  });

  it("retorna undefined para slug inexistente", () => {
    const bundle = getBundleBySlug("no-existe");
    expect(bundle).toBeUndefined();
  });
});

describe("getWorkflowTemplate", () => {
  it("retorna template existente", () => {
    const template = getWorkflowTemplate("crear-presupuesto-base");
    expect(template).toBeDefined();
    expect(template!.name).toBe("Crear presupuesto base");
  });

  it("retorna undefined para slug inexistente", () => {
    const template = getWorkflowTemplate("no-existe");
    expect(template).toBeUndefined();
  });
});

describe("getToolsForBundle", () => {
  const mockTools = [
    { name: "createBudget", risk: "write" },
    { name: "searchPartidas", risk: "read" },
    { name: "calculateAPU", risk: "read" },
    { name: "exportPDF", risk: "export" },
    { name: "createSchedule", risk: "write" },
  ] as unknown as Parameters<typeof getToolsForBundle>[1];

  it("filtra herramientas del bundle budget-agent", () => {
    const tools = getToolsForBundle("budget-agent", mockTools);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map((t) => t.name)).toContain("createBudget");
    expect(tools.map((t) => t.name)).toContain("searchPartidas");
    expect(tools.map((t) => t.name)).toContain("exportPDF");
  });

  it("excluye herramientas que no pertenecen al bundle", () => {
    const tools = getToolsForBundle("apu-agent", mockTools);
    expect(tools.map((t) => t.name)).toContain("calculateAPU");
    expect(tools.map((t) => t.name)).toContain("searchPartidas");
    expect(tools.map((t) => t.name)).not.toContain("createBudget"); // budget-agent only
    expect(tools.map((t) => t.name)).not.toContain("exportPDF"); // reporting-agent only
  });

  it("retorna lista vacía para bundle inexistente", () => {
    const tools = getToolsForBundle("no-existe", mockTools);
    expect(tools).toEqual([]);
  });
});

describe("getBundleSystemPrompt", () => {
  it("retorna system prompt para bundle existente", () => {
    const prompt = getBundleSystemPrompt("review-agent");
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("solo lectura");
  });

  it("retorna null para bundle inexistente", () => {
    const prompt = getBundleSystemPrompt("no-existe");
    expect(prompt).toBeNull();
  });
});
