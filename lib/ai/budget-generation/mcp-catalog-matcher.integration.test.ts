/**
 * Integration test: validates that ALL partidas from the "Vivienda Template"
 * .mcp stored package have strong catalog matches (status="matched").
 *
 * This smoke test catches:
 * - Catalog corruption or accidental deletions
 * - .mcp template drift (items added/removed without catalog sync)
 * - Normalization regressions in buildMatchKey
 *
 * By default it requires >= 95% of items to have exact match (score=1).
 * Items below 1.0 are reported as warnings but don't fail the test
 * as long as they're still "matched" (score >= 0.80).
 *
 * Requires: real database with seeded catalog and stored package.
 * Gracefully skips if data is unavailable (CI-safe).
 */

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { extractBudgetBlueprintFromStoredPackage } from "./mcp-template-extractor";
import { matchBlueprintItemsToCatalog } from "./mcp-catalog-matcher";
import type { McpBudgetBlueprint } from "./mcp-blueprint";

const TEMPLATE_NAME = "Vivienda Template";
const MIN_EXPECTED_ITEMS = 50;
const MIN_EXACT_MATCH_RATIO = 0.95; // at least 95% should be exact matches

describe("mcp-catalog integration: Vivienda Template ↔ catálogo", () => {
  it(
    "al menos 95% de partidas del .mcp tienen match exacto (score=1) y TODAS están matched",
    async () => {
      // 1. Find the stored package — skip gracefully if not seeded
      const pkg = await prisma.storedProjectPackage.findFirst({
        where: { projectName: TEMPLATE_NAME },
      });

      if (!pkg) {
        console.warn(
          `⚠️  SKIP: "${TEMPLATE_NAME}" no encontrado en StoredProjectPackage. ` +
            "¿Ejecutaste el seed o subiste la plantilla?",
        );
        expect(true).toBe(true); // explicit pass with skip log
        return;
      }

      // 2. Extract blueprint from the stored .mcp
      const blueprint = await extractBudgetBlueprintFromStoredPackage({
        packageId: pkg.id,
        userId: pkg.userId,
      });

      const totalItems = blueprint.subBudgets.reduce(
        (sum, sb) => sum + sb.items.length,
        0,
      );

      expect(
        totalItems,
        `"${TEMPLATE_NAME}" tiene ${totalItems} partidas (mínimo esperado: ${MIN_EXPECTED_ITEMS})`,
      ).toBeGreaterThanOrEqual(MIN_EXPECTED_ITEMS);

      // 3. Sanity check: catalog must have items
      const catalogCount = await prisma.catalogPartida.count();
      expect(
        catalogCount,
        `Catálogo vacío (${catalogCount} partidas). ¿Ejecutaste el seed?`,
      ).toBeGreaterThan(0);

      // 4. Run the full matching pipeline against the real catalog
      const matches = await matchBlueprintItemsToCatalog({ blueprint });
      expect(matches).toHaveLength(totalItems);

      // 5. Verify ALL items are "matched" (score >= 0.80)
      const notMatched = matches.filter((m) => m.status !== "matched");
      expect(
        notMatched,
        `${notMatched.length} partidas NO están matched (de ${totalItems})`,
      ).toHaveLength(0);

      // 6. Count exact matches (score=1) vs near-matches
      const exactMatches = matches.filter((m) => m.matchScore === 1);
      const nearMatches = matches.filter(
        (m) => m.status === "matched" && m.matchScore < 1,
      );
      const exactRatio = exactMatches.length / totalItems;

      // 7. Report near-matches as warnings (not failures)
      if (nearMatches.length > 0) {
        const lines = nearMatches.map((m) => {
          const item = findBlueprintItem(blueprint, m.sourceItemId);
          return `  ⚠️  "${item?.description ?? m.sourceItemId}" → score=${m.matchScore} — ${m.reason}`;
        });
        console.warn(
          `${nearMatches.length} partida(s) con match casi-exacto (score < 1):\n${lines.join("\n")}`,
        );
      }

      // 8. Assert minimum exact match ratio
      expect(
        exactRatio,
        `Solo ${exactMatches.length}/${totalItems} partidas tienen match exacto (${(exactRatio * 100).toFixed(1)}%). ` +
          `Mínimo requerido: ${(MIN_EXACT_MATCH_RATIO * 100).toFixed(0)}%. ` +
          `Partidas con match parcial: ${nearMatches.map((m) => findBlueprintItem(blueprint, m.sourceItemId)?.description ?? m.sourceItemId).join(", ")}`,
      ).toBeGreaterThanOrEqual(MIN_EXACT_MATCH_RATIO);
    },
    30_000,
  );
});

function findBlueprintItem(
  blueprint: McpBudgetBlueprint,
  sourceItemId: string,
) {
  for (const sb of blueprint.subBudgets) {
    for (const item of sb.items) {
      if (item.sourceItemId === sourceItemId) return item;
    }
  }
  return null;
}
