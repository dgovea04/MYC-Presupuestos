import { searchStoredPackages } from "@/lib/data/stored-project-packages";
import { normalizePartidaText, uniqueTokens, jaccardSimilarity } from "@/lib/partida-generation/text";
import { PROJECT_TYPE_SYNONYMS, detectProjectTypes, getRelatedTypeScore, findCanonicalType } from "./generation-intent";

// ─── Types ──────────────────────────────────────────────────────────────────

export type McpTemplateCandidate = {
  packageId: string;
  projectName: string;
  projectType: string | null;
  description: string;
  score: number;
  matchedKeywords: string[];
  reasons: string[];
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const MCP_TEMPLATE_STRONG_MATCH = 0.50;
export const MCP_TEMPLATE_REVIEW_MATCH = 0.35;

// ─── Main function ──────────────────────────────────────────────────────────

export async function searchMcpTemplateCandidates(input: {
  userId: string;
  companyId: string;
  description: string;
  projectType?: string;
  areaM2?: number | null;
  floors?: number | null;
  limit?: number;
}): Promise<McpTemplateCandidate[]> {
  const limit = input.limit ?? 5;
  const normalizedQuery = normalizePartidaText(input.description);
  const queryTokens = uniqueTokens(input.description);

  // Detect project types from description
  const detectedTypes = detectProjectTypes(input.description, input.projectType);

  // Fetch stored packages for the user's company
  const packages = await searchStoredPackages(input.description, input.userId, 20);

  if (packages.length === 0) return [];

  // Score each package
  const candidates = packages.map((pkg) => {
    const pkgTokens = uniqueTokens(
      [pkg.projectName, pkg.projectType, pkg.description]
        .filter(Boolean)
        .join(" "),
    );

    // 1. Type match score (0-1, weight 0.50) — includes projectName check
    const typeScore = computeTypeScore(pkg.projectType, pkg.projectName, detectedTypes);

    // 2. Text similarity (0-1, weight 0.15)
    // Note: descriptions are auto-generated, so we weight text lower
    const combinedQueryTokens = uniqueTokens(
      [input.description, input.projectType].filter(Boolean).join(" "),
    );
    const textScore = jaccardSimilarity(combinedQueryTokens, pkgTokens);

    // 3. Keyword extraction (weight 0.15)
    const structuralKeywords = [
      "concreto", "armado", "acero", "albañileria", "drywall",
      "metalica", "aporticado", "dual", "muros",
    ];
    const matchedStructural = structuralKeywords.filter((kw) =>
      normalizedQuery.includes(kw) &&
      pkgTokens.some((t) => t.includes(kw)),
    );
    const keywordScore =
      structuralKeywords.length > 0
        ? matchedStructural.length / Math.min(structuralKeywords.length, 5)
        : 0.5; // neutral when no structural keywords are present

    // 4. Area/floors compatibility (weight 0.10)
    let areaScore = 0;
    const areaMatch = normalizedQuery.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/i);
    const floorMatch = normalizedQuery.match(/(\d+)\s*(?:pisos?|niveles?|plantas?)/i);
    if ((areaMatch || floorMatch) && pkg.description) {
      const pkgArea = pkg.description.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/i);
      const pkgFloors = pkg.description.match(/(\d+)\s*(?:pisos?|niveles?|plantas?)/i);
      if (
        (areaMatch && pkgArea) ||
        (floorMatch && pkgFloors)
      ) {
        areaScore = 0.7;
      }
    }

    // 5. Location score (weight 0.05)
    let locationScore = 0;
    if (input.description.toLowerCase().includes("lima") && pkg.description.toLowerCase().includes("lima")) {
      locationScore = 0.7;
    }

    // 6. Package quality (weight 0.05)
    const qualityScore = pkg.description.length > 20 ? 0.8 : 0.4;

    // Combined weighted score (type-heavy: type is the strongest signal for templates)
    const score = roundScore(
      typeScore * 0.50 +
      textScore * 0.15 +
      keywordScore * 0.15 +
      areaScore * 0.10 +
      locationScore * 0.05 +
      qualityScore * 0.05,
    );

    // Build reasons
    const reasons: string[] = [];
    if (typeScore >= 0.7) reasons.push(`Tipo de obra compatible: "${pkg.projectType}"`);
    if (textScore >= 0.6) reasons.push("Alta similitud textual");
    if (matchedStructural.length > 0) reasons.push(`Keywords técnicas coincidentes: ${matchedStructural.join(", ")}`);
    if (areaScore >= 0.7) reasons.push("Escala comparable");

    // Matched keywords
    const matchedKeywords: string[] = [];
    if (typeScore >= 0.7 && pkg.projectType) matchedKeywords.push(pkg.projectType);
    matchedKeywords.push(...matchedStructural);

    return {
      packageId: pkg.id,
      projectName: pkg.projectName,
      projectType: pkg.projectType || null,
      description: pkg.description,
      score,
      matchedKeywords: [...new Set(matchedKeywords)],
      reasons,
    };
  });

  // Sort by score descending, take top N
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeTypeScore(
  candidateType: string | null,
  candidateName: string,
  detectedTypes: string[],
): number {
  if (!candidateType || detectedTypes.length === 0) return 0.5;

  const normalizedType = normalizePartidaText(candidateType);
  const normalizedName = normalizePartidaText(candidateName);

  // Strongest signal: the project name itself contains a detected type
  // e.g., "Vivienda Template" matches detected type "vivienda"
  for (const type of detectedTypes) {
    if (normalizedName.includes(type)) {
      return 1;
    }
  }

  // Direct match: detected type appears in candidate type
  for (const type of detectedTypes) {
    if (
      normalizedType.includes(type) ||
      PROJECT_TYPE_SYNONYMS[type]?.some((s) => normalizedType.includes(normalizePartidaText(s)))
    ) {
      return 1;
    }
  }

  // Reverse match: candidate type appears in detected synonyms
  for (const [key, synonyms] of Object.entries(PROJECT_TYPE_SYNONYMS)) {
    if (normalizedType === key || synonyms.some((s) => normalizedType.includes(normalizePartidaText(s)))) {
      if (detectedTypes.includes(key)) {
        return 0.8;
      }
    }
  }

  // Cross-type affinity: related groups (e.g., edificio ↔ vivienda)
  const canonicalType = findCanonicalType(normalizedType);
  if (canonicalType) {
    const relatedScore = getRelatedTypeScore(canonicalType, detectedTypes);
    if (relatedScore > 0) return relatedScore;
  }

  return 0.3;
}



function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
