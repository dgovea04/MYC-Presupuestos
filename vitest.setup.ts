import { vi } from "vitest";

// Phase 1 Excel-mode note:
// The global vi.mock("next/cache", ...) below is intentional Phase 1 alignment for the
// revalidateTag(tag, "max") overload tests in app/api/templates/budget/[id]/*,
// app/api/imports/mcp/import/route.ts and siblings. It also covers
// app/api/budgets/[id]/route.ts (AuditDiff narrowing) and app/api/ai/agent/route.ts
// (RegisteredAgentTool inputSchema). Do not scope per-file without verifying that
// every other test in vitest's purview still works without it.

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
}));

class MockResizeObserver implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = MockResizeObserver;
}

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "0px";
  readonly thresholds: ReadonlyArray<number> = [0];

  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}
