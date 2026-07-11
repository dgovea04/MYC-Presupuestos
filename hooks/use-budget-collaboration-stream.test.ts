/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBudgetCollaborationStream, type CollaborationStreamEvent } from "@/hooks/use-budget-collaboration-stream";

describe("useBudgetCollaborationStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not reconnect after its own abort on unmount", async () => {
    vi.mocked(fetch).mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const { unmount } = renderHook(() =>
      useBudgetCollaborationStream({
        budgetId: "budget-1",
        reconnectInterval: 100,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(500);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reconnects when the stream ends unexpectedly", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(makeSseStream([]), { status: 200 }))
      .mockImplementation(() => new Promise<Response>(() => undefined));

    renderHook(() =>
      useBudgetCollaborationStream({
        budgetId: "budget-1",
        reconnectInterval: 100,
      }),
    );

    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(100);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("parses SSE data split across chunks", async () => {
    const onEvent = vi.fn();
    const event: CollaborationStreamEvent = {
      type: "budget.updated",
      budgetId: "budget-1",
      timestamp: "2026-07-11T00:00:00.000Z",
      payload: { field: "name" },
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeSseStream([`event: budget.updated\ndata: ${JSON.stringify(event)}`, "\n\n"]), { status: 200 }),
    );

    renderHook(() =>
      useBudgetCollaborationStream({
        budgetId: "budget-1",
        onEvent,
        reconnectInterval: 100,
      }),
    );

    await flushPromises();

    expect(onEvent).toHaveBeenCalledWith(event);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function makeSseStream(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}
