import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyBetaGrantReminder } from "@/lib/beta/notifications";

describe("beta reminder notifications", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports an unconfigured provider without attempting delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyBetaGrantReminder({
      email: "ana@example.com",
      name: "Ana",
      campaignName: "Piloto",
      daysRemaining: 14,
      expiresAt: new Date("2026-08-29T08:00:00.000Z"),
    })).resolves.toEqual({ configured: false, delivered: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an escaped reminder through Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "MC Presupuestos <no-reply@example.com>");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyBetaGrantReminder({
      email: "ana@example.com",
      name: "Ana <Beta>",
      campaignName: "Piloto & Constructoras",
      daysRemaining: 7,
      expiresAt: new Date("2026-08-22T08:00:00.000Z"),
    })).resolves.toEqual({ configured: true, delivered: true });

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
    }));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as { html: string; to: string[] };
    expect(body.to).toEqual(["ana@example.com"]);
    expect(body.html).toContain("Ana &lt;Beta&gt;");
    expect(body.html).toContain("Piloto &amp; Constructoras");
  });
});
