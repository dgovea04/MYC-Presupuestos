import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthSessionMock, persistMarketingEventMock } = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  persistMarketingEventMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/analytics/store", () => ({ persistMarketingEvent: persistMarketingEventMock }));

import { POST } from "@/app/api/analytics/events/route";

describe("client analytics events route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a consented event with the authenticated user when available", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    persistMarketingEventMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "landing_view",
          clientId: "client-1",
          params: {
            page_path: "/",
            first_touch_utm_source: "google",
          },
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(persistMarketingEventMock).toHaveBeenCalledWith({
      name: "landing_view",
      userId: "user-1",
      clientId: "client-1",
      params: {
        page_path: "/",
        first_touch_utm_source: "google",
      },
    });
  });

  it("rejects unknown event names and malformed identities", async () => {
    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ name: "email_exported", clientId: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(persistMarketingEventMock).not.toHaveBeenCalled();
  });
});
