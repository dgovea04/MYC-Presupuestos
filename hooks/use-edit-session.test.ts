/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEditSession } from "@/hooks/use-edit-session";

describe("useEditSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "clearInterval");
    vi.spyOn(window, "setInterval");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function resolveFetchOk(body: unknown, status = 200) {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );
  }

  function resolveFetchError(status: number, statusText = "Error") {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: statusText }), { status, statusText }),
    );
  }

  function rejectFetch(message: string) {
    vi.mocked(fetch).mockRejectedValueOnce(new Error(message));
  }

  describe("initial state", () => {
    it("returns null activeSession on mount", () => {
      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));
      expect(result.current.activeSession).toBeNull();
    });
  });

  describe("startEditSession", () => {
    it("POSTs to create a session and returns session info", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "APU", entityId: "item-1", field: "apu-editor" }),
        }),
      );

      expect(result.current.activeSession).toEqual({
        sessionId: "session-1",
        entityType: "APU",
        entityId: "item-1",
        field: "apu-editor",
      });
    });

    it("finishes the existing session via DELETE before creating a new one", async () => {
      // First session
      resolveFetchOk({ editSession: { id: "session-1" } });
      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      expect(result.current.activeSession?.sessionId).toBe("session-1");

      // Second session — should DELETE session-1 first, then POST for session-2
      resolveFetchOk({}); // DELETE response
      resolveFetchOk({ editSession: { id: "session-2" } });

      await act(async () => {
        await result.current.startEditSession("METRADO", "item-2", "metrados-dashboard");
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions/session-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ entityType: "METRADO", entityId: "item-2", field: "metrados-dashboard" }),
        }),
      );
      expect(result.current.activeSession?.sessionId).toBe("session-2");
    });

    it("still creates the new session even if finishing the old one fails", async () => {
      // First session
      resolveFetchOk({ editSession: { id: "session-1" } });
      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      expect(result.current.activeSession?.sessionId).toBe("session-1");

      // DELETE fails, but POST should still go through
      rejectFetch("Network error on DELETE");
      resolveFetchOk({ editSession: { id: "session-2" } });

      await act(async () => {
        await result.current.startEditSession("METRADO", "item-2", "metrados-dashboard");
      });

      // DELETE was attempted (the finishing of old session)
      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions/session-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      // POST still went through to create the new session
      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ entityType: "METRADO", entityId: "item-2", field: "metrados-dashboard" }),
        }),
      );
      expect(result.current.activeSession?.sessionId).toBe("session-2");
    });

    it("does nothing when the POST response is not ok", async () => {
      resolveFetchError(500);

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      // Should not set activeSession
      expect(result.current.activeSession).toBeNull();
    });

    it("does not start heartbeat when session creation fails", async () => {
      resolveFetchError(500);

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      // No interval should have been set
      expect(window.setInterval).not.toHaveBeenCalled();
    });

    it("handles network errors gracefully", async () => {
      rejectFetch("Network error");

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      // Should not crash and activeSession remains null
      expect(result.current.activeSession).toBeNull();
    });

    it("starts a heartbeat interval after creating a session", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      expect(result.current.activeSession).not.toBeNull();

      // setInterval should have been called with the heartbeat interval (10s)
      expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 10_000);
    });

    it("clears the previous heartbeat interval before starting a new session", async () => {
      // First session
      resolveFetchOk({ editSession: { id: "session-1" } });
      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      const firstHeartbeatId = (window.setInterval as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      expect(firstHeartbeatId).toBeDefined();

      window.clearInterval.mockClear();

      // Second session
      resolveFetchOk({}); // DELETE
      resolveFetchOk({ editSession: { id: "session-2" } });

      await act(async () => {
        await result.current.startEditSession("METRADO", "item-2", "metrados-dashboard");
      });

      // Should have cleared the previous interval
      expect(window.clearInterval).toHaveBeenCalledWith(firstHeartbeatId);
    });
  });

  describe("heartbeat", () => {
    it("sends a PATCH request at each heartbeat tick", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      expect(result.current.activeSession?.sessionId).toBe("session-1");

      // Set fetch to return a valid response for heartbeat PATCH calls
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      // Advance by one heartbeat interval
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions/session-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("heartbeat failures are silent", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      vi.mocked(fetch).mockRejectedValue(new Error("Network down"));

      // Advance by one heartbeat interval — should not throw
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });

      // No crash, session still active
      expect(result.current.activeSession).not.toBeNull();
    });

    it("stops heartbeat after finishing the session", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      const heartbeatId = (window.setInterval as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      window.clearInterval.mockClear();

      resolveFetchOk({});

      await act(async () => {
        await result.current.finishCurrentSession();
      });

      expect(window.clearInterval).toHaveBeenCalledWith(heartbeatId);

      // Clear call history, then advance time — fetch should NOT be called (heartbeat stopped)
      vi.mocked(fetch).mockClear();
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("finishCurrentSession", () => {
    it("sends DELETE and clears activeSession", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      expect(result.current.activeSession).not.toBeNull();

      resolveFetchOk({});

      await act(async () => {
        await result.current.finishCurrentSession();
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-1/collaboration/edit-sessions/session-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(result.current.activeSession).toBeNull();
    });

    it("is a no-op when no session is active", async () => {
      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.finishCurrentSession();
      });

      // No fetch call should have been made
      expect(fetch).not.toHaveBeenCalled();
      expect(result.current.activeSession).toBeNull();
    });

    it("handles DELETE errors gracefully and still clears state", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-1" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "apu-editor");
      });

      rejectFetch("Network error on DELETE");

      await act(async () => {
        await result.current.finishCurrentSession();
      });

      // Should still clear the session state even if DELETE fails
      expect(result.current.activeSession).toBeNull();
    });
  });

  describe("budgetId changes", () => {
    it("uses the correct budgetId in API calls", async () => {
      resolveFetchOk({ editSession: { id: "session-1" } });

      const { result } = renderHook(() => useEditSession({ budgetId: "budget-custom" }));

      await act(async () => {
        await result.current.startEditSession("APU", "item-1", "custom-editor");
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/budgets/budget-custom/collaboration/edit-sessions",
        expect.any(Object),
      );
    });
  });
});
