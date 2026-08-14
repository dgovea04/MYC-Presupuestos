import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";

describe("admin security alerts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("does not attempt delivery when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyPrimaryAdminSecurityEvent({ action: "MFA_DISABLED", actorEmail: "admin@example.com" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a non-sensitive escaped alert to the protected administrator", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "security@example.com";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyPrimaryAdminSecurityEvent({
      action: "USER_DELETED_PERMANENTLY",
      actorEmail: "admin@example.com",
      targetEmail: "target@example.com",
      detail: "Motivo <test>",
    })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      body: expect.stringContaining("dgovea04@gmail.com"),
    }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { html: string };
    expect(body.html).toContain("Motivo &lt;test&gt;");
    expect(body.html).not.toContain("password");
    expect(body.html).not.toContain("token");
  });
});
