const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 5_000;

export function getKnowledgeRetryDecision(attemptCount: number, now: Date): { retryable: boolean; attempt: number; nextRetryAt?: Date } {
  const attempt = attemptCount + 1;
  if (attempt > MAX_ATTEMPTS) return { retryable: false, attempt };
  return { retryable: true, attempt, nextRetryAt: new Date(now.getTime() + BASE_DELAY_MS * 2 ** (attempt - 1)) };
}
