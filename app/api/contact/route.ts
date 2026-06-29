import { NextResponse } from "next/server";
import { contactRequestSchema } from "@/lib/validations/contact";

const RESEND_API_URL = "https://api.resend.com/emails";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = contactRequestSchema.parse(body);

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    const contactTo = process.env.CONTACT_TO ?? emailFrom;

    if (!contactTo) {
      console.log("[contact] Landing inquiry received", data);
      return NextResponse.json({ ok: true, sent: false });
    }

    if (!resendApiKey || !emailFrom) {
      console.log("[contact] Landing inquiry received", { ...data, contactTo });
      return NextResponse.json({ ok: true, sent: false });
    }

    const html = `
      <h2>Nueva consulta desde el landing de MC Presupuestos</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Empresa:</strong> ${escapeHtml(data.company || "-")}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(data.phone || "-")}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${escapeHtml(data.message).replace(/\n/g, "<br />")}</p>
    `;

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [contactTo],
        reply_to: data.email,
        subject: `Nuevo contacto landing: ${data.name}`,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`No se pudo enviar el correo de contacto: ${errorText}`);
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado" },
      { status: 400 },
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
