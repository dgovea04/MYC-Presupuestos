import { searchMcpTemplateCandidates, MCP_TEMPLATE_STRONG_MATCH } from "./mcp-template-search";
import { searchSimilarProjects } from "./project-similarity";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BudgetGenerationSourceKind =
  | "mcp_strong"
  | "mcp_review"
  | "project_template"
  | "user_template"
  | "catalog"
  | "insufficient_data";

export type BudgetGenerationSourceDecision = {
  kind: BudgetGenerationSourceKind;
  confidence: "high" | "medium" | "low";
  recommendedAction:
    | "preview_mcp"
    | "apply_mcp_after_confirmation"
    | "preview_project_template"
    | "use_catalog"
    | "ask_user";
  reason: string;
  selectedMcpPackage?: {
    packageId: string;
    projectName: string;
    score: number;
    reasons: string[];
  };
  warnings: string[];
};

export type SelectBudgetGenerationSourceInput = {
  userId: string;
  companyId: string;
  projectId?: string;
  description: string;
  projectType?: string;
  templateSource: "auto" | "mcp" | "project" | "catalog";
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PROJECT_TEMPLATE_STRONG_MATCH = 0.50;
const PROJECT_TEMPLATE_MIN_MATCH = 0.35;

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Selecciona la mejor fuente para generar un presupuesto.
 *
 * Orden de preferencia:
 * 1. MCP fuerte (score >= 0.50) → mcp_strong
 * 2. MCP medio (score >= 0.35) → mcp_review
 * 3. Proyecto similar con plantilla (score >= 0.50) → project_template
 * 4. Catálogo → catalog
 * 5. Insuficiente → insufficient_data
 *
 * Si templateSource es explícito (mcp, project, catalog), se respeta esa elección.
 */
export async function selectBudgetGenerationSource(
  input: SelectBudgetGenerationSourceInput,
): Promise<BudgetGenerationSourceDecision> {
  const warnings: string[] = [];

  // ── Explicit catalog → skip all matching ─────────────────────────────────
  if (input.templateSource === "catalog") {
    return {
      kind: "catalog",
      confidence: "medium",
      recommendedAction: "use_catalog",
      reason: "El usuario eligió explícitamente usar el catálogo como fuente.",
      warnings,
    };
  }

  // ── Search MCP templates ─────────────────────────────────────────────────
  if (input.templateSource === "auto" || input.templateSource === "mcp") {
    const mcpResults = await searchMcpTemplateCandidates({
      userId: input.userId,
      companyId: input.companyId,
      description: input.description,
      projectType: input.projectType,
      limit: 3,
    });

    const bestMcp = mcpResults.find((c) => c.score >= MCP_TEMPLATE_STRONG_MATCH);
    if (bestMcp) {
      return {
        kind: "mcp_strong",
        confidence: "high",
        recommendedAction: "apply_mcp_after_confirmation",
        reason: `Plantilla .mcp "${bestMcp.projectName}" con score ${bestMcp.score.toFixed(2)} ≥ 0.50.`,
        selectedMcpPackage: {
          packageId: bestMcp.packageId,
          projectName: bestMcp.projectName,
          score: bestMcp.score,
          reasons: bestMcp.reasons,
        },
        warnings,
      };
    }

    const reviewMcp = mcpResults.find((c) => c.score >= 0.35);
    if (reviewMcp && input.templateSource === "mcp") {
      // Explicit MCP source but weak match → still use it but warn
      warnings.push(`La plantilla .mcp "${reviewMcp.projectName}" tiene score bajo (${reviewMcp.score.toFixed(2)}). Se recomienda revisión.`);
      return {
        kind: "mcp_review",
        confidence: "medium",
        recommendedAction: "preview_mcp",
        reason: `Plantilla .mcp "${reviewMcp.projectName}" con score ${reviewMcp.score.toFixed(2)} (0.35-0.49). Requiere revisión.`,
        selectedMcpPackage: {
          packageId: reviewMcp.packageId,
          projectName: reviewMcp.projectName,
          score: reviewMcp.score,
          reasons: reviewMcp.reasons,
        },
        warnings,
      };
    }

    if (reviewMcp) {
      // Auto source with medium MCP match
      return {
        kind: "mcp_review",
        confidence: "medium",
        recommendedAction: "preview_mcp",
        reason: `Plantilla .mcp "${reviewMcp.projectName}" con score ${reviewMcp.score.toFixed(2)} (0.35-0.49). Requiere confirmación explícita.`,
        selectedMcpPackage: {
          packageId: reviewMcp.packageId,
          projectName: reviewMcp.projectName,
          score: reviewMcp.score,
          reasons: reviewMcp.reasons,
        },
        warnings,
      };
    }

    if (input.templateSource === "mcp") {
      // Explicit MCP but no matches
      warnings.push("No se encontraron plantillas .mcp compatibles. El usuario eligió MCP como fuente.");
      return {
        kind: "insufficient_data",
        confidence: "low",
        recommendedAction: "ask_user",
        reason: "No se encontraron plantillas .mcp compatibles.",
        warnings,
      };
    }
  }

  // ── Search similar projects ──────────────────────────────────────────────
  if (input.templateSource === "auto" || input.templateSource === "project") {
    const similarProjects = await searchSimilarProjects({
      description: input.description,
      projectType: input.projectType,
      userId: input.userId,
    });

    const bestProject = similarProjects.find(
      (p) => p.score >= PROJECT_TEMPLATE_STRONG_MATCH && p.budgetTemplates.length > 0,
    );

    if (bestProject) {
      return {
        kind: "project_template",
        confidence: "high",
        recommendedAction: "preview_project_template",
        reason: `Proyecto similar "${bestProject.projectName}" con score ${bestProject.score.toFixed(2)} y ${bestProject.budgetTemplates.length} plantilla(s).`,
        warnings,
      };
    }

    const reviewProject = similarProjects.find((p) => p.score >= PROJECT_TEMPLATE_MIN_MATCH);
    if (reviewProject && input.templateSource === "project") {
      return {
        kind: "project_template",
        confidence: "medium",
        recommendedAction: "preview_project_template",
        reason: `Proyecto similar "${reviewProject.projectName}" con score ${reviewProject.score.toFixed(2)}.`,
        warnings: [...warnings, "El score es medio — se recomienda revisar las partidas generadas."],
      };
    }
  }

  // ── Fallback to catalog ──────────────────────────────────────────────────
  return {
    kind: "catalog",
    confidence: "medium",
    recommendedAction: "use_catalog",
    reason: "Usando catálogo como fuente (no se encontraron plantillas MCP ni proyectos similares con score suficiente).",
    warnings,
  };
}
