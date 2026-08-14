const RESEND_API_URL = "https://api.resend.com/emails";
const PRIMARY_ADMIN_EMAIL = "dgovea04@gmail.com";

export type AdminSecurityAlert = {
  action: string;
  actorEmail: string;
  targetEmail?: string | null;
  detail?: string;
};

export async function notifyPrimaryAdminSecurityEvent(event: AdminSecurityAlert) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [PRIMARY_ADMIN_EMAIL],
        subject: `[Seguridad] ${formatAction(event.action)} - MC Presupuestos`,
        html: [
          "<p>Se registró una operación administrativa sensible en MC Presupuestos.</p>",
          `<p><strong>Acción:</strong> ${escapeHtml(formatAction(event.action))}</p>`,
          `<p><strong>Administrador:</strong> ${escapeHtml(event.actorEmail)}</p>`,
          event.targetEmail ? `<p><strong>Usuario afectado:</strong> ${escapeHtml(event.targetEmail)}</p>` : "",
          event.detail ? `<p><strong>Detalle:</strong> ${escapeHtml(event.detail)}</p>` : "",
          "<p>Consulta el panel de administración y la auditoría para más información.</p>",
        ].join(""),
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
