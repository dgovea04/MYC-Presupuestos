# Verificación de integración Knowledge Perú / Review Intelligence

Fecha de verificación: 2026-09-10

## Resultado

La implementación de las tareas 1–6 quedó validada en `main`. La prueba E2E de la tarea 7 está implementada y endurecida, pero sus assertions reales no pueden ejecutarse en este entorno porque no están disponibles las variables del fixture PostgreSQL aislado `E2E_REVIEW_BRIDGE_*`.

## Evidencia

| Comando | Resultado |
|---|---|
| `npm.cmd test` | PASS — 736 archivos, 5612 tests |
| `npm.cmd run typecheck` | PASS — exit 0 |
| `npm.cmd run lint` | PASS — exit 0, sin warnings |
| `npm.cmd run build` | PASS — exit 0 |
| `npm.cmd test -- playwright.config.test.ts` | PASS — 1/1 |
| `npm.cmd run test:e2e -- tests/e2e/review-intelligence.spec.ts` | 4 skipped sin fixture; no assertions reales ejecutadas |

La corrección final de dry-run/JSON y la estabilización del test dotenv quedaron en `b4bc70a` y `5f6a963`; la suite completa se repitió después de esos commits y pasó.

El build emitió un warning no bloqueante de trazado NFT relacionado con `lib/s10/sqlserver-local.ts` y avisos existentes sobre `ENCRYPTION_KEY`; no alteraron el exit code. La suite mantiene algunos warnings de consola de pruebas existentes, pero todos los tests pasan.

## PostgreSQL

La prueba real de replay/dry-run se ejecutó contra PostgreSQL local después de aplicar la migración `20260910021440_add_canonical_provenance_links`. Validó dry-run sin escrituras, primera corrida, replay idempotente, skips por no-match/ambiguity, conflicto, error por fila y provenance exacta.

## E2E pendiente

Para ejecutar el recorrido completo se requiere provisionar un fixture local aislado y definir todas las variables `E2E_REVIEW_BRIDGE_*`. La configuración ahora falla explícitamente ante variables parciales, URLs externas, `E2E_NO_WEBSERVER` o servidores reutilizados sin flags Knowledge; no se considera válida una ejecución que omita esas salvaguardas.

## Estado del repositorio

`git diff --check` pasa. El único cambio ajeno no versionado observado durante la tarea es `presupuesto-ejemplo/pdf escaneado/`, preservado sin modificaciones.
