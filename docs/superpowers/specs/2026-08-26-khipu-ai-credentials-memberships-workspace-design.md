# Khipu IA: credenciales, membresías y Workspace — Especificación

## Objetivo

Definir una arquitectura de producción para que Khipu diferencie claramente entre IA incluida por la plataforma, credenciales administradas por un Workspace y API keys propias del usuario (BYOK), con control de membresías, límites, costos, auditoría y fallback.

## Diagnóstico de la implementación actual

- `UserSettings` guarda las API keys de OpenAI, Gemini y OpenRouter del usuario.
- `SystemSettings` guarda las API keys globales y modelos administrados por el sistema.
- Las claves se cifran con AES-256-GCM en `lib/ai/encryption.ts` y se muestran enmascaradas.
- `lib/ai/gateway/execute.ts` prioriza key de usuario y luego key global.
- `MembershipPlan.monthlyTokenLimit`, `User.aiTokenExtraMonthly`, `AiUsagePeriod` y `AiTokenLedger` controlan consumo principalmente por usuario.
- `lib/workspace/entitlements.ts` deriva el plan efectivo desde la suscripción del Workspace, el plan personal y posibles grants Beta.
- Las credenciales no están asociadas al Workspace.
- Las rutas de IA no tienen todavía una política única que indique qué credencial se usa, quién paga o qué límites aplican.

Referencias actuales: `prisma/schema.prisma`, `lib/ai/gateway/execute.ts`, `lib/ai/usage.ts`, `lib/workspace/entitlements.ts`, `lib/data/settings.ts`, `lib/data/system-settings.ts`.

## Decisión de producto

El modo predeterminado será IA incluida por la plataforma. BYOK seguirá disponible como opción avanzada. Los planes Empresa podrán usar una credencial propia del Workspace y administrar políticas por miembro.

### Modos

| Modo | Credencial | Pagador | Quién controla |
|---|---|---|---|
| `PLATFORM` | Global de la plataforma | Plataforma | Super Admin |
| `WORKSPACE` | Del Workspace | Empresa | Owner/Admin |
| `BYOK_ALLOWED` | Usuario si existe; fallback configurado | Usuario | Usuario y política del Workspace |
| `BYOK_ONLY` | Usuario obligatoria | Usuario | Workspace/Empresa |

El Workspace debe poder decidir si BYOK está permitido y si puede sobrescribir la credencial del Workspace. La prioridad no debe quedar fija en código.

## Resolución de credenciales

Crear un resolver central:

```ts
resolveAiCredential({
  userId,
  workspaceId,
  provider,
  task,
}): Promise<ResolvedAiCredential>
```

```ts
type ResolvedAiCredential = {
  provider: AiProviderId;
  credentialSource: "PLATFORM" | "WORKSPACE" | "USER" | "ENVIRONMENT";
  credentialId: string | null;
  apiKey: string | null;
  model: string;
  billingScope: "PLATFORM" | "WORKSPACE" | "USER";
  fallbackAllowed: boolean;
};
```

La resolución debe:

1. Validar pertenencia activa al Workspace.
2. Leer la política efectiva del Workspace.
3. Aplicar el modo configurado.
4. Seleccionar provider y modelo permitidos.
5. Resolver la credencial aplicable.
6. Devolver el origen y alcance de facturación.
7. Rechazar explícitamente una combinación no permitida.

Orden recomendado cuando el modo permite BYOK:

```text
USER → WORKSPACE → PLATFORM → ENVIRONMENT
```

En modo corporativo bloqueado:

```text
WORKSPACE → PLATFORM
```

## Modelo de datos

Agregar modelos Prisma equivalentes a:

### `AiCredential`

- `id`
- `scope`: `PLATFORM | WORKSPACE | USER`
- `workspaceId` nullable
- `userId` nullable
- `provider`
- `secretReference` o secreto cifrado
- `maskedValue`
- `status`: `ACTIVE | INVALID | REVOKED`
- `lastValidatedAt`
- `lastError`
- `createdByUserId`
- `rotatedAt`
- timestamps

Reglas: exactamente un propietario según `scope`, no devolver el secreto al cliente, y permitir una sola credencial activa por propietario/proveedor salvo que exista una credencial marcada como fallback.

### `AiPolicy`

- `workspaceId` único
- `mode`
- `defaultProvider`
- `allowedProviders`
- `allowUserKeys`
- `allowWorkspaceKey`
- `fallbackEnabled`
- `monthlyTokenLimit`
- `monthlyBudgetMinor`
- `hardLimit`
- `alertThresholds`
- timestamps

### Uso y ledger

Extender `AiUsagePeriod` y `AiTokenLedger` con:

- `workspaceId` nullable
- `credentialSource`
- `credentialId` nullable
- `billingScope`
- `requestId`
- `estimatedCostMinor` nullable
- `actualCostMinor` nullable
- `inputTokens` nullable
- `outputTokens` nullable
- `failureCode` nullable

Conservar el ledger como append-only. Los ajustes administrativos deben seguir siendo eventos compensatorios, nunca ediciones destructivas.

## Membresías y límites

Los planes deben expresar, además de `monthlyTokenLimit`:

- si permiten Khipu Chat;
- si permiten Khipu Agente;
- si permiten BYOK;
- si permiten credencial de Workspace;
- proveedores/modelos permitidos;
- límite por usuario;
- límite por Workspace;
- presupuesto mensual;
- funciones de escritura o ejecución del agente.

Cuando se usa una credencial propia, el consumo externo no debe descontar tokens de plataforma, pero sí debe registrarse para auditoría y métricas internas.

## Administración

### Super Admin

Debe poder configurar credenciales globales, probar conexión, rotar, revocar, elegir modelos por defecto, definir fallback, consultar errores y administrar límites por plan. Nunca debe recuperar una clave completa después de guardarla.

### Owner/Admin del Workspace

Debe poder configurar la credencial empresarial, elegir modo, bloquear BYOK, elegir proveedores, establecer presupuesto, asignar límites por miembro, ver consumo y revisar auditoría.

### Usuario

Debe ver una tarjeta de “Fuente de IA actual” que indique:

- fuente activa;
- proveedor y modelo;
- quién asume el costo;
- tokens disponibles si aplica;
- si BYOK está permitido;
- Workspace asociado.

Copy obligatorio para BYOK: “Los costos los cobra directamente el proveedor y no se descuentan de los tokens incluidos en tu membresía.”

## Seguridad

- Usar `ENCRYPTION_KEY` dedicada en producción.
- Preferir Secret Manager y almacenar en base de datos solo una referencia cuando esté disponible.
- Enmascarar claves en API, UI, logs y errores.
- Auditar creación, rotación, prueba, revocación y cambio de política.
- Rate limiting por usuario y Workspace.
- Circuit breaker por proveedor.
- No enviar secretos al cliente.
- No registrar prompts o presupuestos completos en analítica.
- Invalidar cachés de políticas y membresías después de cambios.

## Compatibilidad y migración

Migrar las claves existentes:

- `SystemSettings` → `AiCredential(scope=PLATFORM)`.
- `UserSettings` → `AiCredential(scope=USER)`.

Durante la transición, el resolver debe soportar lectura legacy, pero todas las nuevas escrituras deben usar `AiCredential`. La migración debe ser idempotente y conservar las claves cifradas sin exponerlas.

## Criterios de aceptación

- Cada ejecución identifica `credentialSource`, `billingScope`, Workspace, proveedor y modelo.
- BYOK no consume el cupo global salvo que la política lo indique explícitamente.
- Un Workspace puede bloquear BYOK.
- Un Workspace puede aplicar su propia credencial a todos sus miembros.
- Los límites por usuario y Workspace son atómicos bajo concurrencia.
- Las rutas streaming y no streaming usan el mismo resolver.
- Una key inválida produce estado visible y fallback controlado.
- Las claves completas no aparecen en respuestas, logs ni eventos de analítica.
- Se pueden auditar cambios administrativos y consultar consumo por Workspace, usuario, proveedor y origen.
