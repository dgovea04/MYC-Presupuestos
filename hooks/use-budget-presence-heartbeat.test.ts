/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetBudgetPresenceHeartbeatDedupeForTests,
  useBudgetPresenceHeartbeat,
} from "@/hooks/use-budget-presence-heartbeat";

describe("useBudgetPresenceHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBudgetPresenceHeartbeatDedupeForTests();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "clearInterval");
    vi.spyOn(window, "setInterval");
    vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function resolveFetchOk(status = 200) {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
  }

  describe("initial heartbeat", () => {
    it("sends a POST heartbeat on mount with correct payload", async () => {
      resolveFetchOk();

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/budgets/budget-1",
          module: "budget",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/presence",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            route: "/budgets/budget-1",
            module: "budget",
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("is a no-op when budgetId is empty", () => {
      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "",
          route: "/test",
          module: "test",
        }),
      );

      // No fetch call, no interval set
      expect(fetch).not.toHaveBeenCalled();
      expect(window.setInterval).not.toHaveBeenCalled();
    });

    it("does nothing when budgetId is empty string", () => {
      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "",
          route: "/test",
          module: "test",
        }),
      );

      unmount();

      // No cleanup fetch should be called either
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("heartbeat interval", () => {
    it("sets up an interval at 15 seconds", async () => {
      resolveFetchOk();

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(window.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        15_000,
      );
    });

    it("sends a heartbeat at each interval tick", async () => {
      resolveFetchOk(); // initial
      resolveFetchOk(); // first tick

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();

      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/presence",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends multiple heartbeats across multiple ticks", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();

      await act(async () => {
        vi.advanceTimersByTime(45_000); // 3 ticks
      });

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("stops heartbeats when collaboration presence is unavailable", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("Not found", { status: 404 }));

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
      });

      vi.mocked(fetch).mockClear();

      await act(async () => {
        vi.advanceTimersByTime(45_000);
        await Promise.resolve();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("deduplicates immediate remount heartbeats for the same budget", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
      });

      unmount();

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("heartbeat error handling", () => {
    it("silently handles fetch failures in heartbeat", async () => {
      resolveFetchOk(); // initial succeeds

      const { result } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Subsequent ticks fail
      vi.mocked(fetch).mockRejectedValue(new Error("Network down"));

      // Should not throw
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });

      // Hook still returns sendHeartbeat function
      expect(result.current.sendHeartbeat).toBeDefined();
    });

    it("silently handles initial heartbeat failure", () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network down"));

      // Should not throw on mount
      const { result } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      // Hook still renders and returns sendHeartbeat
      expect(result.current.sendHeartbeat).toBeDefined();
    });
  });

  describe("visibility change", () => {
    it("registers a visibilitychange listener on mount", async () => {
      resolveFetchOk();

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(document.addEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );
    });

    it("sends IDLE status when page becomes hidden", async () => {
      resolveFetchOk(); // initial heartbeat
      resolveFetchOk(); // IDLE heartbeat

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();

      // Simulate page going hidden
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });

      const handler = (document.addEventListener as ReturnType<typeof vi.fn>)
        .mock.calls.find(([event]) => event === "visibilitychange")?.[1] as
        | (() => void)
        | undefined;

      expect(handler).toBeDefined();

      await act(async () => {
        handler!();
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/presence",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            route: "/test",
            module: "test",
            status: "IDLE",
          }),
        }),
      );
    });

    it("resumes ACTIVE heartbeat when page becomes visible again", async () => {
      resolveFetchOk(); // initial
      resolveFetchOk(); // resumed ACTIVE

      renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Make page visible
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });

      const handler = (document.addEventListener as ReturnType<typeof vi.fn>)
        .mock.calls.find(([event]) => event === "visibilitychange")?.[1] as
        | (() => void)
        | undefined;

      vi.mocked(fetch).mockClear();

      await act(async () => {
        handler!();
      });

      // Should call sendHeartbeat which sends ACTIVE
      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/presence",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            route: "/test",
            module: "test",
            status: "ACTIVE",
          }),
        }),
      );
    });
  });

  describe("cleanup", () => {
    it("does not DELETE presence on unmount because presence expires naturally", async () => {
      resolveFetchOk(); // initial POST

      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();

      await act(async () => {
        unmount();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("clears the heartbeat interval on unmount", async () => {
      resolveFetchOk();

      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const intervalId = (
        window.setInterval as unknown as ReturnType<typeof vi.fn>
      ).mock.results[0]?.value;

      window.clearInterval.mockClear();

      await act(async () => {
        unmount();
      });

      expect(window.clearInterval).toHaveBeenCalledWith(intervalId);
    });

    it("removes the visibilitychange listener on unmount", async () => {
      resolveFetchOk();

      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        unmount();
      });

      expect(document.removeEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );
    });

    it("does not send heartbeat after unmount even if interval fires", async () => {
      resolveFetchOk(); // initial

      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        unmount();
      });

      vi.mocked(fetch).mockClear();

      // Advance time — isActiveRef is false, no heartbeat should fire
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // No new fetch calls (only DELETE was called during unmount, then cleared)
      expect(fetch).not.toHaveBeenCalled();
    });

    it("does not perform network cleanup when unmounted immediately", async () => {
      resolveFetchOk(); // initial POST

      const { unmount } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/test",
          module: "test",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();

      await act(async () => {
        unmount();
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("sendHeartbeat return", () => {
    it("returns sendHeartbeat for manual triggering", async () => {
      resolveFetchOk();

      const { result } = renderHook(() =>
        useBudgetPresenceHeartbeat({
          budgetId: "budget-1",
          route: "/manual",
          module: "test",
        }),
      );

      expect(result.current.sendHeartbeat).toBeInstanceOf(Function);

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();
      resolveFetchOk();

      // Manually trigger
      await act(async () => {
        await result.current.sendHeartbeat();
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/presence",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            route: "/manual",
            module: "test",
            status: "ACTIVE",
          }),
        }),
      );
    });
  });

  describe("props updates", () => {
    it("reacts to budgetId changes by restarting presence", async () => {
      resolveFetchOk(); // initial POST for budget-1
      resolveFetchOk(); // initial POST for budget-2

      const { rerender } = renderHook(
        ({ budgetId }) =>
          useBudgetPresenceHeartbeat({
            budgetId,
            route: "/test",
            module: "test",
          }),
        { initialProps: { budgetId: "budget-1" } },
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/presence",
        expect.any(Object),
      );

      // Rerender with new budgetId — old presence expires naturally and new presence starts
      await act(async () => {
        rerender({ budgetId: "budget-2" });
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-2/collaboration/presence",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("updates heartbeat payload when route or module change", async () => {
      resolveFetchOk(); // initial
      resolveFetchOk(); // on route change

      const { rerender } = renderHook(
        ({ route: routeProp }) =>
          useBudgetPresenceHeartbeat({
            budgetId: "budget-1",
            route: routeProp,
            module: "test",
          }),
        { initialProps: { route: "/initial" } },
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      vi.mocked(fetch).mockClear();

      await act(async () => {
        rerender({ route: "/updated" });
      });

      // The initial heartbeat for the new deps should use the updated route
      const postCalls = vi.mocked(fetch).mock.calls.filter(
        ([, init]) =>
          init?.method === "POST",
      );
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      const lastPostBody = JSON.parse(
        (postCalls.at(-1)?.[1] as RequestInit).body as string,
      );
      expect(lastPostBody.route).toBe("/updated");
    });
  });
});
