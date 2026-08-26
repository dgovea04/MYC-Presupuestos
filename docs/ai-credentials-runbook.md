# Runbook de credenciales IA scoped

## Estado de implementación

La resolución de credenciales, políticas por Workspace, contabilidad scoped, auditoría, rotación, revocación y controles de autorización están implementados. El backfill legacy es idempotente mediante `migrateLegacyAiCredentials()`.

## Orden de despliegue

1. Aplicar la migración Prisma.
2. Configurar `ENCRYPTION_KEY` dedicada en staging/producción.
3. Ejecutar el backfill legacy en staging y revisar `scanned`, `migrated`, `skipped` e `invalid`.
4. Activar el resolver scoped y mantener temporalmente el fallback legacy.
5. Verificar rutas streaming, no-streaming, Workspace, BYOK, límites y revocación.
6. Eliminar escrituras legacy únicamente cuando las lecturas scoped estén confirmadas en producción.

## Seguridad operativa

- No registrar API keys, ciphertext, prompts ni referencias de secretos.
- Validar credenciales desde servidor con timeout y errores normalizados.
- Rotar con una clave dedicada y conservar auditoría del actor, Workspace y proveedor.
- `ENCRYPTION_KEY` es obligatoria fuera de desarrollo; el build puede advertir si el entorno local no la define.

## Validación ejecutada

- `npm run typecheck`
- `npm run lint -- --no-cache`
- Suite focalizada de credenciales/políticas/resolver/UI
- `node ./node_modules/next/dist/bin/next build`

## Pendiente de entorno

La ejecución real del backfill y las comprobaciones manuales contra proveedores deben realizarse en staging con base de datos y secretos configurados. No se ejecutan automáticamente desde CI local para evitar modificar datos externos.
