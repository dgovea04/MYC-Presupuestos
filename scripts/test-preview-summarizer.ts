/**
 * Script de prueba para verificar el formato del summarizeResult
 * del nuevo previewBudgetGenerationTool.
 *
 * Ejecutar: npx tsx scripts/test-preview-summarizer.ts
 */
import { previewBudgetGenerationTool } from "../lib/ai/agent/tools/budgets";

// ─── Mock result (simula lo que devolvería la BD) ──────────────────────────

const mockPreviewResult = {
  projectId: "proj-santa",
  description: "vivienda unifamiliar de 2 pisos, 120m2",
  templateType: "vivienda",
  similarProjects: [
    { projectName: "Vivienda Template", projectType: "Vivienda", score: 0.33 },
    { projectName: "Casa Modelo", projectType: "Vivienda", score: 0.28 },
  ],
  mcpPreview: {
    packageId: "pkg-vivienda-001",
    sourceProjectName: "Vivienda Template",
    templateScore: 0.85,
    subBudgets: [
      {
        name: "Estructuras",
        itemCount: 20,
        matchedCatalogItems: 20,
        reviewRequiredItems: 0,
        unmatchedItems: 0,
        estimatedDirectCost: "95000.00",
      },
      {
        name: "Arquitectura",
        itemCount: 30,
        matchedCatalogItems: 28,
        reviewRequiredItems: 2,
        unmatchedItems: 0,
        estimatedDirectCost: "85000.00",
      },
      {
        name: "Instalaciones Sanitarias",
        itemCount: 15,
        matchedCatalogItems: 15,
        reviewRequiredItems: 0,
        unmatchedItems: 0,
        estimatedDirectCost: "35000.00",
      },
      {
        name: "Instalaciones Eléctricas",
        itemCount: 12,
        matchedCatalogItems: 12,
        reviewRequiredItems: 0,
        unmatchedItems: 0,
        estimatedDirectCost: "30000.00",
      },
    ],
    totals: {
      estimatedDirectCost: "245000.00",
      matchedItems: 75,
      reviewRequiredItems: 2,
      unmatchedItems: 0,
    },
    warnings: [
      "2 partidas requieren revisión por similitud baja al catálogo.",
    ],
    assumptions: [
      "Cantidad estimada para vivienda de 2 pisos.",
    ],
  },
  mcpMatchStats: {
    matched: 75,
    reviewRequired: 2,
    unmatched: 0,
    total: 77,
  },
  catalogPreview: null,
  levels: [
    "Nivel 1: 2 proyectos similares encontrados (top: \"Vivienda Template\", score: 0.33)",
    "Nivel 1.5: Plantilla .mcp \"Vivienda Template\" encontrada (score: 0.85)",
    "  Sub-presupuestos: 4",
    "  Partidas: 75 match exacto, 2 revisión requerida, 0 sin match",
    "  Costo directo estimado: S/ 245000.00",
    "Nivel 3: No necesario — 77 partidas disponibles desde .mcp.",
  ],
  warnings: [
    "2 partidas requieren revisión por similitud baja al catálogo.",
  ],
  canGenerate: true,
};

// ─── Escenario 2: solo catálogo (sin .mcp) ─────────────────────────────────

const mockCatalogOnlyResult = {
  projectId: "proj-carretera",
  description: "carretera afirmada de 5km",
  templateType: "carretera",
  similarProjects: [],
  mcpPreview: null,
  mcpMatchStats: null,
  catalogPreview: { foundItems: 18 },
  levels: [
    "Nivel 1: No se encontraron proyectos similares.",
    "Nivel 1.5: No hay paquetes .mcp con score suficiente.",
    "Nivel 3: 18 partidas potenciales desde el catálogo.",
  ],
  warnings: [],
  canGenerate: true,
};

// ─── Escenario 3: con review_required y unmatched ──────────────────────────

const mockWithIssuesResult = {
  projectId: "proj-hospital",
  description: "hospital de 4 pisos",
  templateType: "hospital",
  similarProjects: [
    { projectName: "Clinica Base", projectType: "Hospital", score: 0.35 },
  ],
  mcpPreview: {
    packageId: "pkg-hospital-001",
    sourceProjectName: "Hospital Base",
    templateScore: 0.72,
    subBudgets: [
      {
        name: "Estructuras",
        itemCount: 25,
        matchedCatalogItems: 15,
        reviewRequiredItems: 8,
        unmatchedItems: 2,
        estimatedDirectCost: "180000.00",
      },
      {
        name: "Arquitectura",
        itemCount: 30,
        matchedCatalogItems: 10,
        reviewRequiredItems: 12,
        unmatchedItems: 8,
        estimatedDirectCost: "120000.00",
      },
    ],
    totals: {
      estimatedDirectCost: "300000.00",
      matchedItems: 25,
      reviewRequiredItems: 20,
      unmatchedItems: 10,
    },
    warnings: [
      "20 partidas requieren revisión por similitud baja al catálogo.",
      "10 partidas no tienen coincidencia en el catálogo y usarán datos de la plantilla.",
    ],
    assumptions: [],
  },
  mcpMatchStats: {
    matched: 25,
    reviewRequired: 20,
    unmatched: 10,
    total: 55,
  },
  catalogPreview: null,
  levels: [
    "Nivel 1: 1 proyecto similar encontrado (top: \"Clinica Base\", score: 0.35)",
    "Nivel 1.5: Plantilla .mcp \"Hospital Base\" encontrada (score: 0.72)",
    "  Sub-presupuestos: 2",
    "  Partidas: 25 match exacto, 20 revisión requerida, 10 sin match",
    "  Costo directo estimado: S/ 300000.00",
    "Nivel 3: No necesario — 55 partidas disponibles desde .mcp.",
  ],
  warnings: [
    "20 partidas requieren revisión por similitud baja al catálogo.",
    "10 partidas no tienen coincidencia en el catálogo y usarán datos de la plantilla.",
  ],
  canGenerate: true,
};

// ─── Ejecutar pruebas ──────────────────────────────────────────────────────

function testScenario(name: string, data: Record<string, unknown>) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  📋 ESCENARIO: ${name}`);
  console.log(`${"=".repeat(72)}`);

  const summary = previewBudgetGenerationTool.summarizeResult!(data);
  console.log(`\n📤 summarizeResult output:\n`);
  console.log(summary);
  console.log(`\n${"-".repeat(50)}`);
  console.log(`Tiene \\n (multi-línea)? ${summary.includes("\n") ? "✅ SÍ" : "❌ NO"}`);
  console.log(`Líneas: ${summary.split("\n").length}`);
}

testScenario("Preview exitoso con .mcp (Vivienda)", mockPreviewResult as unknown as Record<string, unknown>);
testScenario("Solo catálogo (sin .mcp)", mockCatalogOnlyResult as unknown as Record<string, unknown>);
testScenario("Con review_required y unmatched", mockWithIssuesResult as unknown as Record<string, unknown>);

console.log(`\n${"=".repeat(72)}`);
console.log("  ✅ PRUEBAS COMPLETADAS");
console.log(`${"=".repeat(72)}\n`);
