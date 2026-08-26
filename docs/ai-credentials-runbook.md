# Runbook de credenciales IA por Workspace

## Variables requeridas

- `ENCRYPTION_KEY`: clave dedicada y estable para AES-256-GCM en producción. No usar la clave fallback.
- `AI_SCOPED_RESOLVER_ENABLED`: `false` durante preparación, `true` para activar el resolver scoped.
- `AI_LEGACY_CREDENTIAL_FALLBACK`: `true` durante la transición; cambiar a `false` solo después de validar el backfill y las lecturas scoped.

Nunca imprimir estas variables ni secretos en logs, reportes o respuestas HTTP.

## Orden de despliegue

1. Ejecutar `npx prisma migrate deploy`.
2. Ejecutar `npx prisma generate`.
3. Confirmar que `ENCRYPTION_KEY` existe y es distinta de la clave de desarrollo.
4. Ejecutar `migrateLegacyAiCredentials()` una vez en staging y producción; la operación es idempotente.
5. Verificar que las respuestas solo contienen valores enmascarados.
6. Activar `AI_SCOPED_RESOLVER_ENABLED=true` con `AI_LEGACY_CREDENTIAL_FALLBACK=true`.
7. Revisar métricas de resolución, fallos, fallback y límites durante un periodo completo.
8. Desactivar escrituras legacy cuando todas las superficies usen `AiCredential`.
9. Cambiar `AI_LEGACY_CREDENTIAL_FALLBACK=false` después de validar el periodo de transición.

## Seguridad

- Rotar `ENCRYPTION_KEY` mediante un procedimiento de re-encriptado controlado; no reemplazarla sin migrar las claves existentes.
- Las API keys completas solo viven en código servidor durante la llamada al proveedor.
- Las auditorías guardan actor, Workspace, proveedor, operación, resultado y código de error, nunca la clave.
- Los endpoints de prueba, creación, rotación y revocación tienen rate limiting.
- No enviar prompts, presupuestos, RUC, emails ni API keys a métricas.

## Rollback

Si se detectan errores de resolución o límites inesperados:

1. Cambiar `AI_SCOPED_RESOLVER_ENABLED=false`.
2. Mantener `AI_LEGACY_CREDENTIAL_FALLBACK=true`.
3. No borrar las tablas nuevas ni el ledger append-only.
4. Investigar los eventos de auditoría y el reporte administrativo.
5. Repetir el backfill solo si se identifican credenciales legacy no migradas.

## Checks obligatorios

```bash
npx prisma validate
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run build
```

## QA manual

- Plataforma: proveedor y modelo configurados, sin Workspace key.
- Workspace: credencial empresarial aplicada a un miembro activo.
- BYOK: key de usuario aplicada y cobrada al usuario.
- `BYOK_ONLY`: rechazo explícito sin key de usuario.
- Fallback habilitado y deshabilitado.
- Streaming y no streaming con la misma fuente y alcance.
- Workspace suspendido o membresía inactiva rechazados.
- Límite por usuario y Workspace bajo solicitudes concurrentes.
- Rotación y revocación dejan solo estado enmascarado.
- Reporte administrativo filtra por Workspace, usuario, proveedor, modelo, origen y tarea.
