# Runbook de credenciales IA

## Políticas jerárquicas P2

Las políticas se evalúan en contexto Workspace, equipo y proyecto. Un nivel inferior solo puede restringir la política superior: nunca puede ampliar proveedores, modelos, límites, fallback, BYOK ni escrituras del agente.

### Endpoints

- `GET /api/workspaces/:workspaceId/ai-policy`: política efectiva del workspace.
- `PUT /api/workspaces/:workspaceId/ai-policy`: actualiza la política del workspace; requiere `OWNER` o `ADMIN`.
- `GET /api/workspaces/:workspaceId/ai-policy/contextual?scope=TEAM|PROJECT&entityId=...`: consulta una política contextual sin exponer secretos.
- `PUT /api/workspaces/:workspaceId/ai-policy/contextual`: actualiza una política de equipo o proyecto; requiere `OWNER` o `ADMIN` y valida ownership contra el workspace.

El servidor vuelve a validar la pertenencia de equipo/proyecto y la membresía del actor. Nunca se confía en un `workspaceId` enviado por el cliente para autorizar otro workspace.

## Operación

Las credenciales se almacenan cifradas, se muestran únicamente enmascaradas y sus operaciones se auditan. Rotación y revocación requieren autorización administrativa y rate limiting. Las respuestas de API no incluyen `encryptedSecret`, API keys ni referencias internas de secretos.

## Despliegue

1. Ejecutar la migración Prisma en staging con backup.
2. Configurar `ENCRYPTION_KEY` mediante Secret Manager.
3. Verificar aislamiento entre workspaces y políticas no expansivas.
4. Activar el scheduler de salud de credenciales.
5. Retirar escrituras legacy solo después de observar el resolver scoped en producción.

## Validación local

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `git diff --check`
