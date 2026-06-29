import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/contact/route";

const fetchMock = vi.fn();

describe("POST /api/contact", () => {
  const previousFetch = global.fetch;
  const previousResendApiKey = process.env.RESEND_API_KEY;
  const previousEmailFrom = process.env.EMAIL_FROM;
  const previousContactTo = process.env.CONTACT_TO;

  afterEach(() => {
    fetchMock.mockReset();
    global.fetch = previousFetch;
    process.env.RESEND_API_KEY = previousResendApiKey;
    process.env.EMAIL_FROM = previousEmailFrom;
    process.env.CONTACT_TO = previousContactTo;
  });

  it("returns ok when the request is valid without configured email delivery", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.CONTACT_TO;

    const response = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Maria Torres",
          email: "maria@example.com",
          phone: "+51 999 999 999",
          company: "Constructora Andina",
          message: "Queremos evaluar una demo para presupuesto, APU y cronograma.",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: false });
  });

  it("sends the inquiry through Resend when the environment is configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "MYC <noreply@example.com>";
    process.env.CONTACT_TO = "ventas@example.com";
    global.fetch = fetchMock as typeof global.fetch;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Maria Torres",
          email: "maria@example.com",
          phone: "+51 999 999 999",
          company: "Constructora Andina",
          message: "Queremos evaluar una demo para presupuesto, APU y cronograma.",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: true });
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "",
          email: "bad-email",
          message: "corto",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("correo");
  });
});
