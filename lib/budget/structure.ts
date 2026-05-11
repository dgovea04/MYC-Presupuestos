import type { BudgetLevelRecord, BudgetLevelType, BudgetRecord, BudgetItemRecord } from "@/types/budget";

export type BudgetDisplayRow =
  | { kind: "level"; level: BudgetLevelRecord; depth: number }
  | { kind: "item"; item: BudgetItemRecord; depth: number };

export const levelTypeLabel: Record<BudgetLevelType, string> = {
  TITLE: "Titulo",
  SUBTITLE: "Subtitulo",
  ITEM_GROUP: "Subpartida",
  SUBITEM: "Subitem",
};

export function buildDisplayRows(budget: BudgetRecord): BudgetDisplayRow[] {
  const rows: BudgetDisplayRow[] = [];
  const levels = [...budget.levels].sort((left, right) => left.sortOrder - right.sortOrder);
  const items = [...budget.items].sort((left, right) => left.sortOrder - right.sortOrder);
  const childrenByParent = new Map<string | null, BudgetLevelRecord[]>();

  for (const level of levels) {
    const key = level.parentId ?? null;
    const bucket = childrenByParent.get(key) ?? [];
    bucket.push(level);
    childrenByParent.set(key, bucket);
  }

  function visitLevel(level: BudgetLevelRecord, depth: number) {
    rows.push({ kind: "level", level, depth });

    items
      .filter((item) => item.levelId === level.id)
      .forEach((item) => {
        rows.push({ kind: "item", item, depth: depth + 1 });
      });

    (childrenByParent.get(level.id) ?? []).forEach((child) => visitLevel(child, depth + 1));
  }

  (childrenByParent.get(null) ?? []).forEach((level) => visitLevel(level, 0));

  items
    .filter((item) => !item.levelId || !levels.some((level) => level.id === item.levelId))
    .forEach((item) => {
      rows.push({ kind: "item", item, depth: 0 });
    });

  return rows;
}
