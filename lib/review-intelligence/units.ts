export type UnitDimension = "length" | "area" | "volume" | "mass" | "count" | "time" | "unknown";

export interface NormalizedUnit {
  canonical: string;
  dimension: UnitDimension;
  comparable: boolean;
  comparableTo: string[];
}

const UNIT_DEFINITIONS: Readonly<Record<string, NormalizedUnit>> = {
  m: { canonical: "m", dimension: "length", comparable: true, comparableTo: ["m"] },
  cm: { canonical: "cm", dimension: "length", comparable: true, comparableTo: ["cm"] },
  mm: { canonical: "mm", dimension: "length", comparable: true, comparableTo: ["mm"] },
  "m²": { canonical: "m²", dimension: "area", comparable: true, comparableTo: ["m²"] },
  "m³": { canonical: "m³", dimension: "volume", comparable: true, comparableTo: ["m³"] },
  kg: { canonical: "kg", dimension: "mass", comparable: true, comparableTo: ["kg"] },
  t: { canonical: "t", dimension: "mass", comparable: true, comparableTo: ["t"] },
  und: { canonical: "und", dimension: "count", comparable: true, comparableTo: ["und"] },
  unidad: { canonical: "und", dimension: "count", comparable: true, comparableTo: ["und"] },
  h: { canonical: "h", dimension: "time", comparable: true, comparableTo: ["h"] },
};

function canonicalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "").replace(/^m2$/, "m²").replace(/^m3$/, "m³");
}

export function normalizeUnit(value: string): NormalizedUnit {
  const canonical = canonicalize(value);
  const known = UNIT_DEFINITIONS[canonical];
  if (known) return { ...known, comparableTo: [...known.comparableTo] };
  return { canonical, dimension: "unknown", comparable: false, comparableTo: [] };
}
