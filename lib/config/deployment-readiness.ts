export type DeploymentTarget = "development" | "staging" | "production";

export type DeploymentEnvironment = Record<string, string | undefined>;

type ReadinessCheckStatus = "ok" | "warning" | "error";

export type DeploymentReadinessCheck = {
  key: string;
  status: ReadinessCheckStatus;
  message: string;
};

export type DeploymentReadinessResult = {
  target: DeploymentTarget;
  ready: boolean;
  checks: readonly DeploymentReadinessCheck[];
  errors: readonly DeploymentReadinessCheck[];
  warnings: readonly DeploymentReadinessCheck[];
};

const MIN_SECRET_LENGTH = 32;
const MIN_CRON_SECRET_LENGTH = 16;

export function resolveDeploymentTarget(
  value: string | undefined,
): DeploymentTarget {
  switch (value?.trim().toLowerCase()) {
    case "production":
      return "production";
    case "staging":
    case "preview":
      return "staging";
    default:
      return "development";
  }
}

export function getDeploymentReadiness(
  environment: DeploymentEnvironment,
  target: DeploymentTarget,
): DeploymentReadinessResult {
  const checks: DeploymentReadinessCheck[] = [];
  const strict = target === "staging" || target === "production";

  addRequiredSecretCheck(checks, environment.DATABASE_URL, "DATABASE_URL", strict, "conexión de base de datos configurada");

  const authSecret = read(environment.AUTH_SECRET);
  const nextAuthSecret = read(environment.NEXTAUTH_SECRET);
  const hasAuthSecret = Boolean(authSecret || nextAuthSecret);

  addCheck(
    checks,
    "authentication_secret",
    hasAuthSecret ? "ok" : strict ? "error" : "warning",
    hasAuthSecret
      ? "secreto de autenticación configurado"
      : "AUTH_SECRET o NEXTAUTH_SECRET debe estar configurado antes de desplegar",
  );

  if (authSecret && nextAuthSecret && authSecret !== nextAuthSecret) {
    addCheck(
      checks,
      "authentication_secret_consistency",
      "error",
      "AUTH_SECRET y NEXTAUTH_SECRET deben coincidir para evitar sesiones inconsistentes",
    );
  } else if (strict && hasAuthSecret && !(authSecret && nextAuthSecret)) {
    addCheck(
      checks,
      "authentication_secret_consistency",
      "warning",
      "configurar ambos secretos con el mismo valor mantiene consistente el rollback entre releases",
    );
  }

  addUrlCheck(checks, environment.NEXTAUTH_URL, "NEXTAUTH_URL", target, strict);
  addUrlCheck(checks, environment.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL", target, strict);

  const cronSecret = read(environment.CRON_SECRET);
  if (!cronSecret) {
    addCheck(
      checks,
      "cron_secret",
      strict ? "error" : "warning",
      "CRON_SECRET es necesario para proteger los cron jobs de producción",
    );
  } else if (cronSecret.length < MIN_CRON_SECRET_LENGTH) {
    addCheck(
      checks,
      "cron_secret",
      "error",
      `CRON_SECRET debe tener al menos ${MIN_CRON_SECRET_LENGTH} caracteres`,
    );
  } else {
    addCheck(checks, "cron_secret", "ok", "secreto de cron configurado");
  }

  const encryptionKey = read(environment.ENCRYPTION_KEY);
  if (!encryptionKey) {
    addCheck(
      checks,
      "encryption_key",
      strict ? "warning" : "ok",
      strict
        ? "ENCRYPTION_KEY no está configurada; se usará AUTH_SECRET como fallback de cifrado"
        : "ENCRYPTION_KEY opcional en desarrollo",
    );
  } else if (encryptionKey.length < MIN_SECRET_LENGTH) {
    addCheck(
      checks,
      "encryption_key",
      "error",
      `ENCRYPTION_KEY debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
    );
  } else {
    addCheck(checks, "encryption_key", "ok", "clave dedicada de cifrado configurada");
  }

  addAnalyticsChecks(checks, environment);
  addEmailChecks(checks, environment, strict);

  const errors = checks.filter((check) => check.status === "error");
  const warnings = checks.filter((check) => check.status === "warning");

  return {
    target,
    ready: errors.length === 0,
    checks,
    errors,
    warnings,
  };
}

function addAnalyticsChecks(
  checks: DeploymentReadinessCheck[],
  environment: DeploymentEnvironment,
) {
  const measurementId = read(environment.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const apiSecret = read(environment.GA_API_SECRET);

  if (!measurementId && !apiSecret) {
    addCheck(checks, "analytics", "warning", "GA4 externo no configurado; analytics interno seguirá disponible");
    return;
  }

  if (measurementId && !/^G-[A-Z0-9]+$/i.test(measurementId)) {
    addCheck(checks, "analytics_measurement_id", "error", "NEXT_PUBLIC_GA_MEASUREMENT_ID no tiene formato GA4 válido");
  } else if (measurementId) {
    addCheck(checks, "analytics_measurement_id", "ok", "measurement ID de GA4 configurado");
  }

  if (apiSecret && !measurementId) {
    addCheck(checks, "analytics_api_secret", "warning", "GA_API_SECRET está configurado sin NEXT_PUBLIC_GA_MEASUREMENT_ID");
  } else if (apiSecret) {
    addCheck(checks, "analytics_api_secret", "ok", "secreto de Measurement Protocol configurado en servidor");
  } else {
    addCheck(checks, "analytics_api_secret", "warning", "GA4 solo enviará eventos de navegador; falta GA_API_SECRET para eventos servidor");
  }
}

function addEmailChecks(
  checks: DeploymentReadinessCheck[],
  environment: DeploymentEnvironment,
  strict: boolean,
) {
  const resendApiKey = read(environment.RESEND_API_KEY);
  const emailFrom = read(environment.EMAIL_FROM);

  if (!resendApiKey && !emailFrom) {
    addCheck(checks, "email", "warning", "correo transaccional no configurado; verificación y avisos no podrán enviarse");
    return;
  }

  if (!resendApiKey || !emailFrom) {
    addCheck(
      checks,
      "email",
      strict ? "warning" : "warning",
      "RESEND_API_KEY y EMAIL_FROM deben configurarse juntos para correo transaccional",
    );
    return;
  }

  addCheck(checks, "email", "ok", "correo transaccional configurado");
}

function addRequiredSecretCheck(
  checks: DeploymentReadinessCheck[],
  value: string | undefined,
  key: string,
  required: boolean,
  successMessage: string,
) {
  addCheck(
    checks,
    key,
    value ? "ok" : required ? "error" : "warning",
    value ? successMessage : `${key} no está configurado`,
  );
}

function addUrlCheck(
  checks: DeploymentReadinessCheck[],
  value: string | undefined,
  key: string,
  target: DeploymentTarget,
  required: boolean,
) {
  const url = read(value);

  if (!url) {
    addCheck(checks, key, required ? "error" : "warning", `${key} no está configurado`);
    return;
  }

  try {
    const parsed = new URL(url);
    const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const secureRequired = target === "production" || (target === "staging" && !localHost);

    if (secureRequired && parsed.protocol !== "https:") {
      addCheck(checks, key, "error", `${key} debe usar HTTPS en ${target}`);
      return;
    }

    addCheck(checks, key, "ok", `${key} tiene una URL válida`);
  } catch {
    addCheck(checks, key, "error", `${key} no contiene una URL válida`);
  }
}

function addCheck(
  checks: DeploymentReadinessCheck[],
  key: string,
  status: ReadinessCheckStatus,
  message: string,
) {
  checks.push({ key, status, message });
}

function read(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
