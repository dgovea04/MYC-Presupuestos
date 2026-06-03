import type { PartidaApuRowRecord } from "@/types/partida";

export const SUBPARTIDA_RESOURCE_TYPE = "SUBPARTIDA";

export function isSubpartidaResourceType(value: string | null | undefined) {
  const normalized = normalizeApuResourceType(value);
  return (
    normalized === "SUBPARTIDA" ||
    normalized === "SUB PARTIDA" ||
    normalized === "SUBPARTIDAS" ||
    normalized === "SUB PARTIDAS"
  );
}

export function normalizeSubpartidaResourceType(value: string | null | undefined) {
  return isSubpartidaResourceType(value) ? SUBPARTIDA_RESOURCE_TYPE : value ?? null;
}

export function clonePartidaApuRowsForBudget(rows: PartidaApuRowRecord[], catalogPartidaId: string) {
  return rows.map((row, index) => ({
    ...row,
    id: crypto.randomUUID(),
    catalogPartidaId,
    sortOrder: row.sortOrder ?? index,
  }));
}

export function normalizeApuResourceType(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
