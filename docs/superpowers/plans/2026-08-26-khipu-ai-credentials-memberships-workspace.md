# Estado de implementación y despliegue

La implementación base P0 y el gobierno empresarial P1 están completados en código. P1 incluye scopes `TEAM` y `PROJECT`, equipos, membresías, validación de ownership, resolver contextual y endpoints administrativos protegidos.

## P1 completado

- [x] Persistencia Prisma de equipos, miembros y scopes contextuales.
- [x] Migración `20260827120000_add_ai_governance_scopes` aplicada en la base local.
- [x] Resolver contextual con precedencia `PROJECT → TEAM → USER → WORKSPACE → PLATFORM`.
- [x] Validación de Workspace, proyecto, equipo y membresía activa antes de leer secretos.
- [x] Endpoints administrativos de equipos, miembros y credenciales contextuales.
- [x] Auditoría de creación de equipos y credenciales contextuales.
- [x] Tests de autenticación, autorización y ownership contextual.
- [x] Typecheck, lint, suite completa y `git diff --check`.

## Requisitos antes de producción

- [ ] Ejecutar migración en staging con backup y revisión de índices.
- [ ] Configurar `ENCRYPTION_KEY` dedicada o Secret Manager.
- [ ] Ejecutar pruebas concurrentes con PostgreSQL de staging.
- [ ] Validar proveedores reales, rotación, revocación y fallback.
- [ ] Confirmar políticas jerárquicas no expansivas con casos reales.
- [ ] Retirar escrituras legacy después de observar el resolver scoped en producción.

El detalle operativo está en `docs/ai-credentials-runbook.md`.
