import { prisma } from "@/lib/db/prisma";
import { normalizePartidaText, uniqueTokens, jaccardSimilarity } from "@/lib/partida-generation/text";
import { listUserBudgetTemplates, type UserBudgetTemplateRecord } from "@/lib/data/budget-templates";
import { searchStoredPackages } from "@/lib/data/stored-project-packages";
import { PROJECT_TYPE_SYNONYMS, detectProjectTypes, getRelatedTypeScore, findCanonicalType } from "./generation-intent";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProjectSimilarityInput = {
  description: string;
  projectType?: string;
  location?: string;
  estimatedArea?: number;
  userId: string;
};

export type ProjectMatch = {
  projectId: string;
  projectName: string;
  projectType: string | null;
  location: string | null;
  score: number;
  matchedKeywords: string[];
  budgetCount: number;
  totalAmount: number;
  budgetTemplates: UserBudgetTemplateRecord[];
};

export type ProjectCandidate = {
  projectId: string;
  projectName: string;
  projectType: string | null;
  location: string | null;
  source: "internal";
  score: number;
  matchedKeywords: string[];
  budgetCount: number;
  totalAmount: number;
  budgetTemplateIds: string[];
};

// ─── Structural keywords ────────────────────────────────────────────────────

const STRUCTURAL_KEYWORDS = [
  "concreto", "armado", "acero", "albañileria", "drywall", "metalica",
  "aporticado", "dual", "muros", "portico", "madera", "adobe",
];

const AREA_PATTERN = /(\d+(?:\.\d+)?)\s*(?:m2|m²|metros\s*cuadrados|m\s*2|hectareas|ha|km2|km²)/i;

// ─── Main function ──────────────────────────────────────────────────────────

export async function searchSimilarProjects(
  input: ProjectSimilarityInput,
): Promise<ProjectMatch[]> {
  const normalizedQuery = normalizePartidaText(input.description);
  const queryTokens = uniqueTokens(input.description);

  // Parse area from description
  const areaMatch = normalizedQuery.match(AREA_PATTERN);
  const parsedArea = areaMatch ? Number.parseFloat(areaMatch[1]) : null;

  // Detect project type from description
  const detectedTypes = detectProjectTypes(input.description, input.projectType);

  // Detect structural keywords
  const structuralMatches = STRUCTURAL_KEYWORDS.filter((kw) =>
    normalizedQuery.includes(kw),
  );

  // Fetch user's projects from DB
  const projects = await prisma.project.findMany({
    where: {
      company: {
        memberships: {
          some: {
            userId: input.userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      projectType: true,
      location: true,
      budgets: {
        select: {
          id: true,
          kind: true,
          totalAmount: true,
        },
        where: { kind: "GENERAL" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch stored .mcp packages (repo) — scoped to user's companies
  const storedPackages = await searchStoredPackages(input.description, input.userId, 10);

  if (projects.length === 0 && storedPackages.length === 0) {
    return [];
  }

  // Fetch user's templates (for linking)
  const templates = await listUserBudgetTemplates(input.userId);
  const templatesByProjectId = new Map<string, UserBudgetTemplateRecord[]>();
  for (const tpl of templates) {
    if (tpl.sourceProjectId) {
      const existing = templatesByProjectId.get(tpl.sourceProjectId) ?? [];
      existing.push(tpl);
      templatesByProjectId.set(tpl.sourceProjectId, existing);
    }
  }

  // Score each project
  const candidates: ProjectCandidate[] = projects.map((project) => {
    const projectTokens = uniqueTokens(
      [project.name, project.projectType, project.location]
        .filter(Boolean)
        .join(" "),
    );
    // 1. Type match score (0-1)
    const typeResult = computeTypeScore(
      project.projectType,
      detectedTypes,
      queryTokens,
    );
    const typeScore = typeResult.score;
    const typeMatched = typeResult.matched;

    // 2. Description/project name similarity (0-1)
    const textScore = jaccardSimilarity(queryTokens, projectTokens);

    // 3. Structural keyword match (0-1)
    let structuralScore = 0;
    const matchedStructural: string[] = [];
    if (structuralMatches.length > 0) {
      const projectTextTokens = uniqueTokens(
        [project.name, project.projectType, project.location]
          .filter(Boolean)
          .join(" "),
      );
      const projectText = projectTextTokens.join(" ");
      for (const kw of structuralMatches) {
        if (projectText.includes(kw)) {
          matchedStructural.push(kw);
        }
      }
      structuralScore =
        matchedStructural.length / Math.max(structuralMatches.length, 1);
    }

    // 4. Area proximity (0-1)
    let areaScore = 0;
    if (parsedArea && input.estimatedArea) {
      const ratio = Math.min(parsedArea, input.estimatedArea) / Math.max(parsedArea, input.estimatedArea);
      areaScore = ratio >= 0.5 ? ratio : 0;
    }

    // 5. Location match (0-1)
    let locationScore = 0;
    if (input.location && project.location) {
      const normalizedInputLocation = normalizePartidaText(input.location);
      const normalizedProjectLocation = normalizePartidaText(project.location);
      if (normalizedInputLocation === normalizedProjectLocation) {
        locationScore = 1;
      } else if (
        normalizedInputLocation.includes(normalizedProjectLocation) ||
        normalizedProjectLocation.includes(normalizedInputLocation)
      ) {
        locationScore = 0.7;
      }
    }

    // Combined weighted score
    const score = roundScore(
      typeScore * 0.35 +
      textScore * 0.30 +
      structuralScore * 0.15 +
      areaScore * 0.10 +
      locationScore * 0.10,
    );

    const generalBudget = project.budgets.find((b) => b.kind === "GENERAL");

    // Collect matched keywords for display
    const matchedKeywords = [
      ...(typeMatched && project.projectType
        ? [project.projectType]
        : []),
      ...matchedStructural,
    ];

    return {
      projectId: project.id,
      projectName: project.name,
      projectType: project.projectType,
      location: project.location,
      source: "internal" as const,
      score,
      matchedKeywords: [...new Set(matchedKeywords)],
      budgetCount: project.budgets.length,
      totalAmount: generalBudget ? Number(generalBudget.totalAmount) : 0,
      budgetTemplateIds: (templatesByProjectId.get(project.id) ?? []).map((t) => t.id),
    };
  });

  // Build .mcp repo candidates with the same weighted scoring formula.
  // MCP packages lack location and area data so those factors default to 0 —
  // this is fair: internal projects with richer data rank higher on equal matches.
  const mcpCandidates: ProjectMatch[] = storedPackages.map((pkg) => {
    const pkgText = [pkg.projectName, pkg.projectType, pkg.description]
      .filter(Boolean)
      .join(" ");
    const pkgTokens = uniqueTokens(pkgText);

    // 1. Type match (uses shared helper — same logic as internal)
    const typeResult = computeTypeScore(
      pkg.projectType,
      detectedTypes,
      queryTokens,
    );
    const typeScore = typeResult.score;
    const typeMatched = typeResult.matched;

    // 2. Text similarity (same Jaccard as internal projects)
    const textScore = jaccardSimilarity(queryTokens, pkgTokens);

    // 3. Structural keyword match
    const matchedStructural = structuralMatches.filter((kw) =>
      pkgText.includes(kw),
    );
    const structuralScore =
      structuralMatches.length > 0
        ? matchedStructural.length / structuralMatches.length
        : 0;

    // Same weighted formula. Area and location default to 0 (no data).
    const score = roundScore(
      typeScore * 0.35 +
      textScore * 0.30 +
      structuralScore * 0.15,
    );

    // Build matchedKeywords consistently with internal candidates
    const matchedKeywords = [
      ...(typeMatched && pkg.projectType
        ? [pkg.projectType]
        : []),
      ...matchedStructural,
    ];

    return {
      projectId: pkg.id,
      projectName: pkg.projectName,
      projectType: pkg.projectType,
      location: null,
      score,
      matchedKeywords: [...new Set(matchedKeywords)],
      budgetCount: 0,
      totalAmount: 0,
      budgetTemplates: [],
    };
  });

  // Merge internal + .mcp repo candidates, sort by score, take top 5
  const merged = [...candidates, ...mcpCandidates];
  const sorted = merged
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Map to result type
  return sorted.map((c) => ({
    projectId: c.projectId,
    projectName: c.projectName,
    projectType: c.projectType,
    location: c.location,
    score: c.score,
    matchedKeywords: c.matchedKeywords,
    budgetCount: c.budgetCount,
    totalAmount: c.totalAmount,
    budgetTemplates: templatesByProjectId.get(c.projectId) ?? [],
  }));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Scores how well a candidate's project type matches the detected types.
 * Returns both the score (0-1) and whether any type keywords matched.
 */
function computeTypeScore(
  candidateType: string | null,
  detectedTypes: string[],
  queryTokens: string[],
): { score: number; matched: boolean } {
  if (!candidateType) return { score: 0, matched: false };

  const normalizedType = normalizePartidaText(candidateType);

  // Forward: detected type → candidate type
  for (const type of detectedTypes) {
    if (
      normalizedType.includes(type) ||
      PROJECT_TYPE_SYNONYMS[type]?.some((s) => normalizedType.includes(s))
    ) {
      return { score: 1, matched: true };
    }
  }

  // Reverse: candidate type → detected types / query tokens
  for (const [key, synonyms] of Object.entries(PROJECT_TYPE_SYNONYMS)) {
    if (
      normalizedType === key ||
      synonyms.some((s) => normalizedType.includes(s))
    ) {
      if (
        detectedTypes.includes(key) ||
        queryTokens.some((t) => synonyms.includes(t))
      ) {
        return { score: 0.8, matched: true };
      }
    }
  }

  // Cross-type affinity: related groups (e.g., edificio ↔ vivienda)
  const canonicalType = findCanonicalType(normalizedType);
  if (canonicalType) {
    const relatedScore = getRelatedTypeScore(canonicalType, detectedTypes);
    if (relatedScore > 0) {
      return { score: relatedScore, matched: true };
    }
  }

  return { score: 0, matched: false };
}



function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
