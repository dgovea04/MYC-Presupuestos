const UNIT_ALIASES: Record<string, string> = {
  "m2": "M²",
  "m²": "M²",
  "m^2": "M²",
  "m3": "M³",
  "m³": "M³",
  "m^3": "M³",
  "kg": "KG",
  "kilogramo": "KG",
  "kilogramos": "KG",
  "und": "UND",
  "unidad": "UND",
  "unidades": "UND",
  "bolsa": "BOL",
  "bolsas": "BOL",
};

export function normalizeKnowledgeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeKnowledgeUnit(value: string): string {
  const trimmed = value.trim();
  const key = normalizeKnowledgeText(trimmed).replace(/\s+/g, "");
  return UNIT_ALIASES[key] ?? trimmed;
}

