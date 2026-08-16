const RESEND_API_URL = "https://api.resend.com/emails";

export type BetaReminderNotification = {
  email: string;
  name: string;
  campaignName: string;
  daysRemaining: number;
  expiresAt: Date;
};

export type BetaNotificationResult = {
  configured: boolean;
  delivered: boolean;
};

export async function notifyBetaGrantReminder(
  notification: BetaReminderNotification,
): Promise<BetaNotificationResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    return { configured: false, delivered: false };
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
        to: [notification.email],
        subject: `Tu acceso Pro Beta vence en ${notification.daysRemaining} días - MC Presupuestos`,
        html: [
          `<p>Hola ${escapeHtml(notification.name)},</p>`,
          `<p>Tu acceso Pro Beta para la campaña <strong>${escapeHtml(notification.campaignName)}</strong> vence en <strong>${notification.daysRemaining} días</strong>.</p>`,
          `<p>Fecha de vencimiento: <strong>${escapeHtml(formatDate(notification.expiresAt))}</strong>.</p>`,
          "<p>Puedes revisar las opciones de upgrade desde tu cuenta antes del vencimiento.</p>",
          "<p>MC Presupuestos</p>",
        ].join(""),
      }),
    });

    return { configured: true, delivered: response.ok };
  } catch {
    return { configured: true, delivered: false };
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
