export const reviewDocumentCategories = ["PLAN", "TECHNICAL_SPECIFICATION", "QUANTITY_TAKEOFF", "BUDGET", "APU", "OTHER"] as const;

export type ReviewDocumentCategory = (typeof reviewDocumentCategories)[number];

export type ClassificationSuggestion = {
  category: ReviewDocumentCategory;
  score: number;
  signals: string[];
};

export type ClassificationSuggestionInput = {
  fileName: string;
  extension?: string;
  headers?: string[];
};

type Candidate = Exclude<ReviewDocumentCategory, "OTHER">;

const categoryOrder: Candidate[] = ["QUANTITY_TAKEOFF", "APU", "BUDGET", "TECHNICAL_SPECIFICATION", "PLAN"];
const filenamePatterns: ReadonlyArray<{ category: Candidate; signal: string; pattern: RegExp }> = [
  { category: "QUANTITY_TAKEOFF", signal: "filename:metrado", pattern: /metrad|cantidad|quantity/i },
  { category: "APU", signal: "filename:apu", pattern: /(?:^|[ _.-])apu(?:[ _.-]|$)|an[aá]lisis.*precio/i },
  { category: "BUDGET", signal: "filename:presupuesto", pattern: /presupuesto|budget/i },
  { category: "TECHNICAL_SPECIFICATION", signal: "filename:specification", pattern: /especificaci|specification|memoria.*t[eé]cnica/i },
  { category: "PLAN", signal: "filename:plan", pattern: /plano|planimetr|drawing/i },
];
const headerPatterns: ReadonlyArray<{ category: Candidate; signal: string; pattern: RegExp }> = [
  { category: "QUANTITY_TAKEOFF", signal: "header:metrado", pattern: /metrado|cantidad|quantity/i },
  { category: "APU", signal: "header:apu", pattern: /apu|rendimiento|precio unitario/i },
  { category: "BUDGET", signal: "header:presupuesto", pattern: /presupuesto|costo directo|importe/i },
  { category: "TECHNICAL_SPECIFICATION", signal: "header:specification", pattern: /especificaci|requisito t[eé]cnico/i },
  { category: "PLAN", signal: "header:plan", pattern: /plano|escala|l[aá]mina/i },
];

export function suggestDocumentClassification(input: ClassificationSuggestionInput): ClassificationSuggestion {
  const scores = new Map<Candidate, number>(categoryOrder.map((category) => [category, 0]));
  const signals: string[] = [];
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const extension = (input.extension ?? extensionFrom(fileName)).trim().toLowerCase();

  for (const candidate of filenamePatterns) {
    if (!candidate.pattern.test(fileName)) continue;
    scores.set(candidate.category, (scores.get(candidate.category) ?? 0) + 0.6);
    signals.push(candidate.signal);
  }
  for (const header of input.headers ?? []) {
    for (const candidate of headerPatterns) {
      if (!candidate.pattern.test(header)) continue;
      scores.set(candidate.category, (scores.get(candidate.category) ?? 0) + 0.4);
      signals.push(candidate.signal);
    }
  }
  if (extension === ".xlsx") signals.push("extension:xlsx");
  if (extension === ".pdf") signals.push("extension:pdf");

  const winner = categoryOrder.reduce<Candidate | undefined>((current, category) => {
    if (!current || (scores.get(category) ?? 0) > (scores.get(current) ?? 0)) return category;
    return current;
  }, undefined);
  const score = winner ? Math.min(1, scores.get(winner) ?? 0) : 0;
  return winner && score > 0
    ? { category: winner, score, signals: [...new Set(signals)] }
    : { category: "OTHER", score: 0, signals: ["fallback:other"] };
}

function extensionFrom(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index) : "";
}
