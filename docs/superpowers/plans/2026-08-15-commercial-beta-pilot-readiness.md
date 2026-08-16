# Commercial Beta Pilot Readiness

> Runbook operativo para validar y activar el piloto comercial sin ejecutar cambios sobre la base de datos desde desarrollo.

**Related plan:** `docs/superpowers/plans/2026-08-15-commercial-beta-access.md`  
**Related spec:** `docs/superpowers/specs/2026-08-15-commercial-beta-access-design.md`

## Estado

- Código de beta comercial: preparado.
- Migración Prisma: creada y pendiente de aplicar en staging.
- QA automatizado: preparado.
- QA manual: pendiente en staging.
- Piloto comercial: no iniciar hasta completar las puertas de salida de este documento.

## 1. Preflight técnico

### Verificaciones locales ya realizadas

- [x] `npm run prisma:generate`
- [x] `npm run test -- lib/beta app/api/admin/beta app/api/analytics/events/route.test.ts app/api/billing/checkout/route.test.ts lib/ai/usage.test.ts lib/workspace/entitlements.test.ts`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] La migración no se ha ejecutado desde desarrollo.

### Variables requeridas en staging

Configurar en el entorno de staging, nunca en el repositorio:

- `DATABASE_URL`: base de datos de staging.
- `CRON_SECRET`: secreto de longitud suficiente para proteger el scheduler.
- `AUTH_SECRET`: secreto de autenticación de staging.
- Variables existentes de Stripe en modo test.
- Variables existentes de GA4/Measurement Protocol, si se desea envío externo.

### Variables opcionales

- `RESEND_API_KEY`: habilita el envío de recordatorios.
- `EMAIL_FROM`: remitente verificado para recordatorios.
- `ENCRYPTION_KEY`: clave dedicada recomendada por el build para API keys.

Si Resend no está configurado, la reconciliación debe continuar y registrar los hitos sin bloquear el acceso ni la expiración.

## 2. Aplicación controlada de migración en staging

La migración debe aplicarse únicamente cuando `DATABASE_URL` apunte explícitamente a staging.

```bash
npm run prisma:migrate
```

Después verificar:

- Existen las tablas `beta_campaigns` y `beta_grants`.
- Existen los enums de campaña, asignación y grant.
- El índice único `(campaignId, userId)` existe.
- No hubo cambios en `MembershipPlan` ni `BillingSubscription`.
- `npm run prisma:generate` termina correctamente.

No ejecutar `prisma:seed` para crear campañas reales. Las campañas del piloto deben crearse desde el panel administrativo para validar auditoría y permisos.

## 3. Validación del scheduler

Verificar en staging:

1. El cron `/api/cron/reconcile-beta-grants` está publicado.
2. La plataforma conserva el cron definido en `vercel.json`.
3. Una solicitud sin secreto devuelve `401`.
4. Una solicitud con `CRON_SECRET` válido procesa la reconciliación.
5. Si `CRON_SECRET` no está configurado, el endpoint devuelve `500` y no procesa datos.
6. Una segunda ejecución no duplica recordatorios ni eventos de hito.

Ejemplo de invocación autorizada:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<staging-host>/api/cron/reconcile-beta-grants"
```

No incluir el secreto en URLs compartidas, capturas ni logs persistentes.

## 4. Campaña interna de validación

Crear desde `/admin?adminTab=beta`:

```text
Nombre: QA Pro Beta 60 días
Código: QA-PRO-60
Duración: 60 días
Modo: MIXED
Límite: 2 usuarios
Correo verificado: requerido
Suscripción pagada: excluida
Beta previa: excluida
```

Pruebas mínimas:

- [ ] Crear la campaña en estado `DRAFT`.
- [ ] Activarla.
- [ ] Ejecutar preview de elegibilidad.
- [ ] Asignar un usuario elegible.
- [ ] Repetir la asignación y confirmar idempotencia.
- [ ] Intentar asignar un usuario con suscripción pagada.
- [ ] Intentar superar el límite de dos asignaciones.
- [ ] Revocar un grant con motivo.
- [ ] Extender otro grant con motivo.
- [ ] Descargar el export con un usuario que tenga `beta.export`.
- [ ] Confirmar que las operaciones aparecen en `AdminAuditLog`.

## 5. Validación de entitlements y facturación

Para un usuario Starter con grant vigente:

- [ ] La licencia efectiva es Pro.
- [ ] La cuenta muestra `Pro Beta`.
- [ ] Se muestra fecha de vencimiento y días restantes.
- [ ] La facturación indica que no existe cobro durante la beta.
- [ ] No se crea ni modifica `BillingSubscription`.

Para un usuario con Stripe Pro o Empresa:

- [ ] Mantiene su plan pagado.
- [ ] El grant no lo degrada.
- [ ] La metadata beta no reemplaza la fuente pagada.

Para un grant vencido o revocado:

- [ ] Se niegan las features Pro según la licencia efectiva.
- [ ] El usuario conserva sus proyectos, presupuestos y datos.
- [ ] Aparece el CTA de upgrade cuando corresponde.

## 6. Validación de reconciliación y notificaciones

Usar datos de staging o relojes controlados en pruebas; no modificar manualmente producción.

- [ ] Un grant `SCHEDULED` pasa a `ACTIVE` después de `startsAt`.
- [ ] Un grant con `expiresAt <= now` pasa a `EXPIRED`.
- [ ] Un grant revocado nunca vuelve a `ACTIVE`.
- [ ] Los hitos de 14, 7 y 1 día se registran una sola vez.
- [ ] El evento de expiración se registra una sola vez.
- [ ] Los metadatos previos del grant se conservan.
- [ ] Con Resend configurado, el correo se entrega al destinatario de prueba.
- [ ] Sin Resend configurado, el cron termina sin bloquear la reconciliación.

## 7. Validación de analytics

Confirmar en almacenamiento interno y, si está habilitado, en GA4:

- [ ] `beta_eligible`.
- [ ] `beta_assigned`.
- [ ] `beta_started`.
- [ ] `beta_feature_used`.
- [ ] Uso de IA y exportaciones.
- [ ] `beta_expiring_14d`, `beta_expiring_7d` y `beta_expiring_1d`.
- [ ] `beta_expired`.
- [ ] `beta_upgrade_clicked`.
- [ ] `beta_checkout_started`.
- [ ] Conversión pagada.

Verificar que no se envían a GA4 correo, nombre, IDs internos, IDs de proyectos ni contenido de presupuestos. Las acciones de proyectos demo deben quedar excluidas de la activación comercial.

## 8. Límites y soporte del piloto

Antes de invitar usuarios externos, definir por escrito:

- [ ] Máximo inicial de 20–50 usuarios.
- [ ] Campaña principal de 60 días.
- [ ] Grupo de comparación de 90 días, si existe un segmento claro.
- [ ] Límite mensual de tokens o coste de IA.
- [ ] Responsable de revisar métricas semanalmente.
- [ ] Canal de soporte.
- [ ] Tiempo objetivo de respuesta.
- [ ] Procedimiento para revocar un grant abusivo.
- [ ] Procedimiento para extender un grant por incidente.

## 9. Criterios de salida

El piloto puede comenzar únicamente cuando:

- [ ] La migración fue aplicada y verificada en staging.
- [ ] El flujo de creación, asignación, expiración y revocación fue probado manualmente.
- [ ] El cron protegido ejecutó al menos dos veces sin duplicar hitos.
- [ ] Los eventos de analytics aparecen en el dashboard.
- [ ] Los límites de IA y soporte tienen responsable asignado.
- [ ] Existe una campaña limitada a 20–50 usuarios.
- [ ] Existe un procedimiento de rollback.

## 10. Rollback operativo

Si aparece un problema durante el piloto:

1. Pausar la campaña desde el panel.
2. Detener nuevas asignaciones automáticas/códigos si aplica.
3. Revocar únicamente grants afectados, dejando motivo en auditoría.
4. Mantener la base de datos y los datos de usuarios intactos.
5. Revisar `AdminAuditLog`, eventos beta y logs del cron.
6. No eliminar tablas ni revertir la migración como respuesta inicial.
7. Corregir el código, validar nuevamente en staging y reanudar con una campaña nueva o explícitamente auditada.

## 11. Siguientes fases después del piloto

- Comparar conversión de 60 frente a 90 días.
- Ajustar reglas de elegibilidad y mensajes de upgrade.
- Añadir códigos de referidos con límites específicos.
- Evaluar grants a nivel empresa/workspace.
- Definir política comercial permanente para usuarios beta convertidos.
