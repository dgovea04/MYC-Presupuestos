// ─── Types ──────────────────────────────────────────────────────────────────

export type ConfirmationResult =
  | { kind: "affirmative"; confidence: "high" | "medium" }
  | { kind: "negative"; confidence: "high" | "medium" }
  | { kind: "modify"; confidence: "high" | "medium"; requestedChange: string }
  | { kind: "unclear"; confidence: "low" };

// ─── Affirmative phrases ────────────────────────────────────────────────────

const AFFIRMATIVE_PHRASES = [
  "si",
  "sí",
  "ok",
  "okay",
  "dale",
  "procede",
  "proceder",
  "adelante",
  "hazlo",
  "correcto",
  "confirmado",
  "de acuerdo",
  "vamos",
  "aplica",
  "aplicar",
  "generar",
  "genera",
  "yes",
  "go ahead",
  "proceed",
  "do it",
  "apply",
] as const;

const NEGATIVE_PHRASES = [
  "no",
  "cancelar",
  "cancela",
  "no gracias",
  "no quiero",
  "mejor no",
  "no por ahora",
  "detente",
  "alto",
  "abortar",
  "cancel",
  "stop",
  "abort",
] as const;

const MODIFY_PHRASES = [
  "cambia",
  "cambiar",
  "modifica",
  "modificar",
  "ajusta",
  "ajustar",
  "en vez de",
  "en lugar de",
  "mejor usa",
  "usa mejor",
  "prefiero",
  "change",
  "modify",
  "instead",
  "rather",
] as const;

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Detecta si un mensaje del usuario es una confirmación, negación o modificación.
 *
 * Reglas:
 * - Si el mensaje es exactamente una frase afirmativa → affirmative (high).
 * - Si el mensaje empieza con una frase afirmativa seguida de espacio/puntuación → affirmative (medium).
 * - Si contiene frases negativas con límite de palabra → negative.
 * - Si contiene frases de modificación → modify.
 * - Si ninguna regla aplica → unclear.
 *
 * @param message Mensaje del usuario (normalizado a minúsculas)
 */
export function detectConfirmation(message: string): ConfirmationResult {
  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // ── Exact affirmative (high confidence) ─────────────────────────────────
  for (const phrase of AFFIRMATIVE_PHRASES) {
    if (lower === phrase) {
      return { kind: "affirmative", confidence: "high" };
    }
  }

  // ── Starts-with affirmative (medium confidence) ────────────────────────
  for (const phrase of AFFIRMATIVE_PHRASES) {
    if (lower.startsWith(phrase + " ") || lower.startsWith(phrase + ",") || lower.startsWith(phrase + ".")) {
      return { kind: "affirmative", confidence: "medium" };
    }
  }

  // ── Exact negative (high) ───────────────────────────────────────────────
  for (const phrase of NEGATIVE_PHRASES) {
    if (lower === phrase) {
      return { kind: "negative", confidence: "high" };
    }
  }

  // ── Modify ──────────────────────────────────────────────────────────────
  for (const phrase of MODIFY_PHRASES) {
    if (containsWord(lower, phrase)) {
      const idx = lower.indexOf(phrase);
      const rest = lower.slice(idx + phrase.length).trim();
      const requestedChange = rest.length > 0 ? rest : lower;
      return { kind: "modify", confidence: "medium", requestedChange };
    }
  }

  // ── Negative with word boundary (medium) ────────────────────────────────
  for (const phrase of NEGATIVE_PHRASES) {
    if (containsWord(lower, phrase)) {
      return { kind: "negative", confidence: "medium" };
    }
  }

  return { kind: "unclear", confidence: "low" };
}

/**
 * Verifica si una palabra/frase está presente como palabra completa en el texto.
 * Evita falsos positivos como "no" dentro de "buenos" o "necesito".
 */
function containsWord(text: string, word: string): boolean {
  // For multi-word phrases, just use includes
  if (word.includes(" ")) {
    return text.includes(word);
  }
  // For single words, use word boundary
  const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
  return regex.test(text);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
