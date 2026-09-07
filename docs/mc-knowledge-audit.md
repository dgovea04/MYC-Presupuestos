# Auditoría de arquitectura — MC Knowledge Perú V0

Fecha: 2026-09-07  
Fuente: `prd/PRD_MC_Knowledge_Peru_V0.md`

## Estado del repositorio

- Aplicación Next.js App Router con TypeScript y Prisma sobre PostgreSQL.
- El trabajo se ejecuta directamente en `main`, por solicitud explícita.
- El repositorio ya contiene funcionalidades de presupuestos, APU, recursos, importaciones, MC Revisor, Khipu, auditoría y versionado.
- No existe todavía un dominio `MC Knowledge` persistido como tal.

## Mapping de dominios existentes

| Concepto del PRD | Modelo/servicio existente | Decisión |
|---|---|---|
| Company / Project / User | `Company`, `Project`, `User`, `CompanyMembership` | Reutilizar; todas las consultas privadas validan tenancy en servidor. |
| Partida de presupuesto | `BudgetItem` | Referenciar desde eventos y observaciones; no duplicar como partida operativa. |
| Partida de catálogo | `CatalogPartida` y `PartidaApuRow` | Usar como fuente de candidatos y futura vinculación canónica. |
| Recurso | `Resource` | Mantener como catálogo operativo; agregar capa canónica de Knowledge que pueda referenciarlo. |
| APU | `Apu`, `ApuResource` | Mantener como APU operativo; crear versión/snapshot de Knowledge sólo para historial reutilizable. |
| Cambios de presupuesto | `BudgetChangeEvent` | No reemplazarlo; emitir `KnowledgeEvent` sólo para cambios con significado de conocimiento. |
| Versionado | `BudgetVersionSnapshot` | Reutilizar como referencia de snapshots de correcciones; no usarlo como sustituto general de APUVersion. |
| Documentos/evidencia | `ProjectDocument`, `DocumentVersion`, `ProjectAttachment`, `ReviewEvidence` | `KnowledgeSource`/`KnowledgeEvidence` relacionarán provenance sin mover archivos ni duplicar documentos. |
| Revisión | `ReviewRun`, `ReviewFinding`, `FindingDecision`, `EntityLink` | Emitir eventos desde decisiones confirmadas, enlaces validados y evidencia confirmada. |
| Khipu | `lib/ai`, `app/api/ai`, herramientas de revisión y APU | Consumirá retrieval interno después de existir el core estructurado. |
| Importadores | `app/api/imports`, `lib/s10`, `lib/pdf-import`, `lib/review-intelligence` | Registrar origen/importación y eventos; no mutar presupuestos desde Knowledge. |
| Auditoría general | `AdminAuditLog`, `ReviewAuditEvent`, `BudgetChangeEvent` | Mantener separado de KnowledgeEvent; se relacionarán por metadata/correlationId cuando corresponda. |

## Riesgos identificados

1. `Resource.companyId` nullable permite recursos globales y privados; el nuevo servicio debe distinguir explícitamente scope y no inferir Global por ausencia de empresa.
2. `Project` tiene región textual (`region`, `province`, `district`); Knowledge usará una jerarquía propia y conservará el texto original como metadata de migración.
3. `ConfidenceLevel` existente sólo tiene `LOW`, `MEDIUM`, `HIGH`; Knowledge requiere `VERY_LOW` y `VERY_HIGH`, por lo que se agregará un enum específico o se ampliará cuidando el dominio Revisor.
4. `Apu` no tiene versionado propio; se agregará snapshot versionado referenciado al APU existente y con checksum de contenido para detectar cambios estructurales.
5. JSON de provenance debe validarse en el servicio y no confiar únicamente en el frontend.

## Orden de entrega

Se implementará primero el core persistente y consultable: eventos, provenance, scopes, entidades canónicas y observaciones. Las integraciones de eventos y la UI administrativa se incorporarán sobre esos contratos, dejando embeddings, benchmarks y ML fuera de V0.

