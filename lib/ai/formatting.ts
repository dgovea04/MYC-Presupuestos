/**
 * Utility functions for formatting AI-generated text output.
 *
 * AI providers (especially cloud models) often return text with mixed
 * formatting artifacts: HTML tags like <br>, markdown bold (**text**),
 * and other noise that should be cleaned before rendering.
 */

/**
 * Cleans raw AI output text for display by:
 * - Converting consecutive <br> tags into double newlines (paragraph breaks)
 * - Converting remaining single <br> tags into single newlines
 * - Stripping all HTML tags while preserving their inner text
 * - Normalizing whitespace (collapsing 3+ consecutive newlines to 2)
 *
 * Call this before passing AI answers to the markdown renderer.
 */
export function formatAiText(text: string): string {
  let cleaned = text;

  // Replace consecutive <br> variants with double newlines (paragraph separator).
  // Handles <br><br>, <br/> <br/>, <br>\n<br>, etc.
  cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, "\n\n");

  // Replace remaining single <br> variants with single newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Strip all remaining HTML tags while preserving inner content
  cleaned = cleaned.replace(/<\/?[^>]+>/g, "");

  // Normalize: collapse 3+ consecutive newlines into 2 (preserves paragraph separation)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}
