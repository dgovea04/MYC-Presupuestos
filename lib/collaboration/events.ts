import type { CollaborationStreamEvent, CollaborationStreamEventType } from "@/types/collaboration";

/**
 * Simple in-memory event broker for SSE subscribers.
 * Registers per-budget subscribers and publishes typed events.
 * Sufficient for development and simple deployments where all
 * instances share the same process.
 */

type SubscriberFn = (event: CollaborationStreamEvent) => void;

const subscribers = new Map<string, Set<SubscriberFn>>();

export function subscribeBudgetEvents(budgetId: string, fn: SubscriberFn): () => void {
  if (!subscribers.has(budgetId)) {
    subscribers.set(budgetId, new Set());
  }
  subscribers.get(budgetId)!.add(fn);

  return () => {
    const budgetSubs = subscribers.get(budgetId);
    if (budgetSubs) {
      budgetSubs.delete(fn);
      if (budgetSubs.size === 0) {
        subscribers.delete(budgetId);
      }
    }
  };
}

export function publishBudgetEvent(
  budgetId: string,
  type: CollaborationStreamEventType,
  payload: unknown,
): void {
  const event: CollaborationStreamEvent = {
    type,
    budgetId,
    timestamp: new Date().toISOString(),
    payload,
  };

  const budgetSubs = subscribers.get(budgetId);
  if (budgetSubs && budgetSubs.size > 0) {
    for (const fn of budgetSubs) {
      try {
        fn(event);
      } catch {
        // swallow subscriber errors to avoid breaking fan-out
      }
    }
  }
}

/**
 * Returns the number of active subscriptions for a budget.
 * Useful for health/debugging.
 */
export function getSubscriberCount(budgetId: string): number {
  return subscribers.get(budgetId)?.size ?? 0;
}

/**
 * Clears all subscriptions. Used in tests to reset state.
 */
export function clearAllSubscribers(): void {
  subscribers.clear();
}
