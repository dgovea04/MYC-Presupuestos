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

export type BetaApplicationNotification = {
  email: string;
  name: string;
};

export async function notifyBetaApplicationReceived(
  notification: BetaApplicationNotification,
): Promise<BetaNotificationResult> {
  return sendBetaApplicationEmail({
    notification,
    subject: "Recibimos tu solicitud de acceso piloto - MC Presupuestos",
    html: [
      `<p>Hola ${escapeHtml(notification.name)},</p>`,
      "<p>Recibimos tu solicitud de acceso piloto a MC Presupuestos.</p>",
      "<p>El equipo revisará tu solicitud de forma manual. Si es aprobada, recibirás otro correo con la información necesaria para iniciar sesión.</p>",
      `<p>Para completar el proceso, crea y verifica tu cuenta usando este mismo correo: <strong>${escapeHtml(notification.email)}</strong>.</p>`,
      "<p>MC Presupuestos</p>",
    ].join(""),
  });
}

export async function notifyBetaApplicationApproved(
  notification: BetaApplicationNotification,
): Promise<BetaNotificationResult> {
  return sendBetaApplicationEmail({
    notification,
    subject: "Tu acceso piloto fue aprobado - MC Presupuestos",
    html: [
      `<p>Hola ${escapeHtml(notification.name)},</p>`,
      "<p>Tu solicitud de acceso piloto fue aprobada.</p>",
      "<p>Se habilitó tu acceso Pro Beta temporal por 60 días, sin cobro ni suscripción Stripe.</p>",
      `<p>Correo de acceso: <strong>${escapeHtml(notification.email)}</strong></p>`,
      `<p><a href="${buildAppUrl("/login")}">Iniciar sesión en MC Presupuestos</a></p>`,
      "<p>Por seguridad, no enviamos contraseñas por correo. Usa la contraseña que definiste al crear tu cuenta.</p>",
      "<p>MC Presupuestos</p>",
    ].join(""),
  });
}

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

async function sendBetaApplicationEmail(params: {
  notification: BetaApplicationNotification;
  subject: string;
  html: string;
}): Promise<BetaNotificationResult> {
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
        to: [params.notification.email],
        subject: params.subject,
        html: params.html,
      }),
    });

    return { configured: true, delivered: response.ok };
  } catch {
    return { configured: true, delivered: false };
  }
}

function buildAppUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  return `${baseUrl}${path}`;
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
