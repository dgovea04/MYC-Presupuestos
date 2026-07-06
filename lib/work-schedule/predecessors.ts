const PREDECESSOR_RELATIONS = new Set(["FS", "SS", "FF", "SF"] as const);

export type WorkSchedulePredecessorRelation = "FS" | "SS" | "FF" | "SF";

export type WorkSchedulePredecessorReference = {
  code: string;
  relation: WorkSchedulePredecessorRelation;
  lagDays: number;
};

const PREDECESSOR_TOKEN_REGEX = /^(.+?)(?:(FS|SS|FF|SF))?(?:(\+|-)(\d+)d)?$/i;
const DEFAULT_PREDECESSOR_CODE_REGEX = /^\d+(?:\.\d+)*$/;

export function parseWorkSchedulePredecessors(value: string | null | undefined): WorkSchedulePredecessorReference[] {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return [];
  }

  return normalized
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => parseWorkSchedulePredecessorToken(segment));
}

/**
 * Non-throwing variant that returns null when the predecessor string
 * is syntactically invalid. Useful for intermediate editing states
 * (e.g., user partially typing or deleting a predecessor code).
 */
export function tryParseWorkSchedulePredecessors(value: string | null | undefined): WorkSchedulePredecessorReference[] | null {
  try {
    return parseWorkSchedulePredecessors(value);
  } catch {
    return null;
  }
}

export function validateWorkSchedulePredecessors(
  value: string | null | undefined,
  {
    allowedCodes,
    currentItemCode,
  }: {
    allowedCodes: Set<string>;
    currentItemCode?: string | null;
  },
) {
  for (const reference of parseWorkSchedulePredecessors(value)) {
    if (!allowedCodes.has(reference.code)) {
      throw new Error(`La predecesora ${reference.code} no existe en este cronograma`);
    }

    if (currentItemCode && reference.code === currentItemCode) {
      throw new Error("La partida no puede ser predecesora de si misma");
    }
  }
}

export function formatGeneratedPredecessor(itemCode: string) {
  return `${itemCode}FS`;
}

function parseWorkSchedulePredecessorToken(value: string): WorkSchedulePredecessorReference {
  const match = PREDECESSOR_TOKEN_REGEX.exec(value);
  if (!match) {
    throw new Error("Ingresa una predecesora valida");
  }

  const [, rawCode, rawRelation, rawLagSign, rawLagDays] = match;
  const code = rawCode.trim();
  if (!code || (!rawRelation && !rawLagDays && !DEFAULT_PREDECESSOR_CODE_REGEX.test(code))) {
    throw new Error("Ingresa una predecesora valida");
  }

  const relation = (rawRelation?.toUpperCase() ?? "FS") as WorkSchedulePredecessorRelation;
  if (!PREDECESSOR_RELATIONS.has(relation)) {
    throw new Error("Ingresa una predecesora valida");
  }

  const lagDays = rawLagDays ? Number(rawLagDays) * (rawLagSign === "-" ? -1 : 1) : 0;
  if (!Number.isInteger(lagDays)) {
    throw new Error("Ingresa una predecesora valida");
  }

  return {
    code,
    relation,
    lagDays,
  };
}
