# Runbook de lanzamiento — Usuarios Fundadores Perú

## Alcance

Campaña piloto de MC Presupuestos para captar profesionales peruanos y validar el flujo Starter → activación → Pro.

- Duración del acceso: **60 días**.
- Plan concedido: **Pro**.
- Precio durante el piloto: **sin cargo**.
- Suscripción Stripe: **no se crea**.
- Revisión: **solo Super Admin**.
- Código interno de campaña: `founding-users-peru`.

## Antes de habilitar tráfico

Ejecutar el preflight desde el mismo commit que se desplegará. El comando solo imprime estados y nombres de checks; nunca imprime secretos ni URLs con credenciales:

```bash
npm run check:deployment -- --target=staging
```

Para producción, repetir el check con el target correspondiente después de cargar las variables de Production:

```bash
npm run check:deployment -- --target=production
```

No continuar si aparece `Deployment readiness: NOT READY`. Las advertencias deben revisarse y quedar aceptadas explícitamente por el responsable del release.

- [ ] Confirmar que `DATABASE_URL` apunta al entorno correcto.
- [ ] Aplicar la migración `20260816100000_add_beta_applications`.
- [ ] Verificar que existen `security_rate_limit_buckets`, `admin_audit_logs`, `marketing_events`, `beta_campaigns` y `beta_grants`.
- [ ] Ejecutar `npm run prisma:generate` en el entorno de despliegue.
- [ ] Confirmar que existe al menos un usuario con perfil `SUPER_ADMIN` y MFA operativo.
- [ ] Confirmar que el dominio público y `NEXT_PUBLIC_APP_URL` son correctos.
- [ ] Confirmar la política de privacidad y el consentimiento de analytics.
- [ ] Verificar `NEXT_PUBLIC_GA_MEASUREMENT_ID` si se requiere medición GA4.
- [ ] Verificar que `GA_API_SECRET` solo exista en variables de servidor si se usa Measurement Protocol.

## Orden de staging y smoke test

1. Crear una base de datos de staging aislada y cargar las variables de Preview/Staging.
2. Ejecutar `npm run check:deployment -- --target=staging`.
3. Ejecutar los gates locales/CI: `npm run lint`, `npm run typecheck`, pruebas relevantes y `npm run build`.
4. Desplegar el commit aprobado a staging.
5. Aplicar la migración con `npx prisma migrate deploy`; no usar `migrate dev`, `db push` ni `migrate reset`.
6. Ejecutar `npx prisma generate` y `npx prisma migrate status`.
7. Confirmar que `/software-presupuestos-construccion` y `/api/beta/applications` responden correctamente.
8. Ejecutar el smoke test controlado: solicitud, revisión Super Admin, grant Pro de 60 días, ausencia de `BillingSubscription`, auditoría y analytics.
9. Repetir el preflight con `--target=production` antes de promover el deployment.

## Aplicar la base de datos

La migración debe aplicarse mediante el proceso normal del entorno, nunca desde la landing ni desde una ruta HTTP.

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

La migración crea:

- enum `BetaApplicationStatus`;
- tabla `beta_applications`;
- relación opcional con el Super Admin revisor;
- índices por estado y fecha;
- índice único parcial para impedir solicitudes simultáneas activas del mismo correo y campaña.

El índice parcial permite que una solicitud `REJECTED` vuelva a solicitar acceso, pero evita duplicados en `PENDING` o `APPROVED`.

## Flujo operativo

1. El visitante entra a `/software-presupuestos-construccion`.
2. Se captura la atribución UTM y el contexto del CTA.
3. Envía nombre y email desde `#piloto`.
4. `POST /api/beta/applications` valida y aplica rate limiting.
5. La solicitud queda en `PENDING` y se envía un correo de recepción al email indicado.
6. Un Super Admin entra a `/admin?adminTab=beta`.
7. El equipo confirma que el solicitante creó y verificó una cuenta con el mismo email.
8. Super Admin aprueba o rechaza la solicitud.
9. Al aprobarse:
   - se crea o activa la campaña `Usuarios Fundadores Perú`;
   - se asigna un `BetaGrant` Pro por 60 días;
   - se registra auditoría;
   - se registra `beta_assigned`.
10. Se envía un correo de aprobación con el email asociado y el enlace de login. No se envían contraseñas por correo.
11. El usuario puede usar el acceso Pro temporal sin alterar una suscripción Stripe.

## Requisitos para aprobar

La aprobación exige:

- usuario existente con el mismo email;
- email verificado;
- cuenta activa;
- no tener una suscripción Pro activa incompatible;
- no tener un grant Beta previo incompatible.

Si el solicitante aún no tiene cuenta o no verificó su correo, la solicitud debe mantenerse `PENDING` hasta completar ese paso.

## Acciones de rollback

- Para retirar acceso antes de tiempo, usar la acción administrativa de revocar el `BetaGrant`.
- No cambiar manualmente `membershipPlanId` del usuario para retirar un grant Beta.
- No eliminar solicitudes para corregir duplicados; conservar la auditoría y usar `REJECTED` cuando corresponda.
- No crear una suscripción Stripe para compensar o reemplazar un grant Beta.

## Observabilidad semanal

Revisar en `/admin`:

- solicitudes `PENDING`, `APPROVED` y `REJECTED`;
- grants asignados y próximos a vencer;
- solicitudes → aprobaciones → asignaciones;
- `beta_assigned`, `beta_feature_used`, `beta_upgrade_clicked` y `beta_converted`;
- errores de rate limiting;
- eventos anónimos y atribución UTM faltante;
- auditoría de `BETA_APPLICATION_APPROVED`, `BETA_APPLICATION_REJECTED` y `BETA_GRANT_ASSIGNED`.

## Privacidad y seguridad

- La interfaz pública solo solicita nombre y email.
- La lista de solicitudes no se expone a visitantes.
- El correo de recepción confirma la solicitud y explica que el equipo enviará el acceso después de aprobarla.
- El correo de aprobación incluye el email de acceso y el enlace de login, pero nunca una contraseña.
- La API administrativa exige sesión con capacidad Beta.
- Aprobar o rechazar exige Super Admin.
- No enviar emails, nombres, RUC, montos ni contenido de presupuestos a analytics.
- Mantener `GA_API_SECRET` y credenciales de base de datos fuera del navegador.
- Revisar y depurar las solicitudes conforme a la política de retención definida por el producto.

## QA antes de anunciar la campaña

- [ ] Landing carga en desktop y móvil.
- [ ] CTA Starter lleva a `/register`.
- [ ] Video placeholder se puede reemplazar desde `DEMO_VIDEO_URL`.
- [ ] Formulario Beta muestra confirmación y maneja duplicados.
- [ ] Se recibe el correo de solicitud enviada.
- [ ] Se recibe el correo de aprobación con enlace de login y sin contraseña.
- [ ] Rate limiting devuelve `429` sin revelar información sensible.
- [ ] Un administrador no Super Admin puede leer según su capacidad, pero no revisar.
- [ ] Super Admin puede aprobar y rechazar.
- [ ] La aprobación crea un grant Pro de 60 días.
- [ ] La aprobación no crea BillingSubscription.
- [ ] La revocación conserva auditoría.
- [ ] `npm run lint`, `npm run typecheck` y pruebas relevantes pasan.

## Criterio de salida controlada

No abrir campañas pagadas hasta confirmar al menos una solicitud completa en un entorno controlado y verificar en base de datos:

1. solicitud `PENDING`;
2. revisión administrativa;
3. aplicación `APPROVED`;
4. `BetaGrant` con `planSlug = "pro"`;
5. `expiresAt` 60 días después de `startsAt`;
6. ausencia de una nueva suscripción Stripe;
7. auditoría y analytics persistidos.
