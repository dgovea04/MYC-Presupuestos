# MC Knowledge Perú V0 — Operación

## Estado y rollout

V0 se habilita inicialmente para uso interno mediante `/admin/knowledge` y APIs autenticadas. No se habilita promoción automática a conocimiento global ni modificación automática de presupuestos.

El despliegue debe ejecutarse en este orden:

1. aplicar la migración Prisma en un entorno respaldado;
2. verificar `prisma migrate status`;
3. ejecutar pruebas y health checks;
4. habilitar el acceso administrativo;
5. revisar eventos y provenance antes de exponer retrieval a otros productos.

## Privacidad y scopes

- `GLOBAL`: catálogo compartido; escritura y confirmación requieren superadministrador.
- `COMPANY`: solo miembros activos del workspace; no se comparte entre compañías.
- `PROJECT`: requiere pertenencia al workspace y al proyecto.
- `USER`: solo el usuario propietario.

Las observaciones conservan fuente, evidencia, fecha, unidad, contexto y confianza. Una observación no se convierte automáticamente en assertion o conocimiento global.

## Logs y monitoreo

Revisar periódicamente:

- eventos con claves idempotentes repetidas o conflictos de payload;
- observaciones rechazadas por Decimal, unidad, scope o provenance;
- errores de integración S10, MCP y Revisor;
- intentos de acceso entre workspaces;
- fuentes sin evidencia suficiente.

Los adaptadores de integración no bloquean la operación principal si Knowledge no está disponible: registran una advertencia y conservan el resultado operativo.

## Deuda técnica y límites V0

Quedan fuera de V0 embeddings, ML, scraping, benchmarks públicos, marketplace y recomendaciones automáticas. La siguiente fase debe ampliar pruebas end-to-end, métricas de retrieval, revisión de retención y promoción explícita mediante assertions.
