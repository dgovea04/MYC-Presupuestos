# Operación de MC Revisión Inteligente V1

MC Revisión Inteligente V1 compara partidas persistidas del presupuesto con evidencia extraída de documentos PDF y XLSX. El resultado es una corrida auditable: las evidencias, vínculos, hallazgos y decisiones humanas se conservan aunque una corrida pase a `STALE`.

## Configuración y límites

La configuración se envía en `POST /api/budgets/:id/review-runs` junto con una clave `Idempotency-Key`:

```json
{
  "configuration": {
    "maxFiles": 10,
    "maxPdfPages": 300,
    "maxFileSizeMb": 50,
    "maxXlsxSheets": 20,
    "tolerancePercent": "1.00",
    "findingTypes": ["QUANTITY_MISMATCH", "UNIT_INCONSISTENCY"]
  },
  "documentVersionIds": ["version-id"],
  "rulesVersion": "review-rules-v1"
}
```

Los límites validables de V1 son: 1–10 archivos por corrida, PDF de 1–300 páginas, XLSX de 1–20 hojas y archivos de hasta 50 MB. `tolerancePercent` debe ser un decimal positivo o cero con punto decimal; los cálculos se ejecutan con `decimal.js`.

## Estados y cancelación

- Una corrida sigue las etapas persistidas `validating`, `extracting`, `classifying`, `identifying evidence`, `matching`, `rules`, `prioritizing` y `completed`.
- `POST /api/review-runs/:id/cancel` sólo solicita cancelación. El estado pasa a `CANCEL_REQUESTED`; el worker comprueba la solicitud entre etapas y finaliza como `CANCELLED` sin borrar resultados parciales.
- `STALE` significa que una fuente o configuración cambió después de la corrida. No se deben resolver hallazgos sin reconfirmación cuando la corrida está obsoleta.
- Las invalidaciones registran `ReviewAuditEvent` con `REVIEW_RUN_STALE`, fingerprint, actor cuando existe, entidad afectada, estado anterior y nuevo estado.

## Qué marca una corrida como `STALE`

Se marca la corrida afectada cuando cambia una cantidad, unidad, descripción o APU de partida; se reemplaza o reclasifica una fuente; o cambia la versión de reglas, tipos de hallazgo o tolerancia. La selección se limita al tenant, proyecto y presupuesto relacionados.

## Datos persistidos y cobertura V1

Las métricas siguen persistidas dentro de `ReviewRun.progressJson.metrics`; no se agregaron columnas de métricas. Además de `analyzedItems`, `totalItems`, `coveragePercent`, `evidenceCount`, `linkedEvidenceCount`, los conteos de hallazgos, fallos, incompletitud y delta, V1 escribe:

- `coverageByCategory.quantity`, `unit`, `specification`, `apuComponent` y `yield`: conteos de evidencias que aportan cada clase de dato. La interfaz muestra metrado, unidades, especificación, APU y rendimiento; `unit` también queda disponible para API y diagnóstico.
- `partiallyCoveredSources`: número de versiones de documento distintas con al menos una entrada de cobertura `OCR_REQUIRED` o `FAILED`.

Un campo V1 ausente en una corrida histórica no equivale a cero: significa que la corrida se produjo antes de que se calculara ese dato. Un cero explícito significa que se calculó la métrica y no se encontró evidencia de esa categoría.

La evidencia conserva sus columnas base (`originalText`, `normalizedText`, `value`, `unit`, `locationJson`, método, confianza y hash) y usa `ReviewEvidence.metadataJson` para el contexto enriquecido: `primary`, `code`, `description`, `technicalSpecification`/`technicalSpec`, `discipline`, `attributes`, `apuComponents`, `yield`, `quantity` y el método de extracción. Los valores numéricos normalizados se almacenan como texto decimal; no deben convertirse a `number` para recalcular importes.

`YIELD_MISMATCH` es un hallazgo cuando el rendimiento documentado y el rendimiento del APU presupuestado son finitos, comparables por unidad y superan la tolerancia de la corrida. Su `comparisonJson` conserva valor documentado, valor presupuestado, diferencia y unidad. Igual que el resto de hallazgos, persiste `humanReviewRequired: true` y `automaticBudgetMutation: false`.

## Cobertura parcial y decisión humana

La advertencia de cobertura parcial indica una limitación de la fuente, no que todos sus valores sean incorrectos. El conteo se hace por versión de documento, no por página, celda o evidencia; una versión con varias páginas pendientes cuenta una sola vez. Reprocesa las páginas u hojas señaladas antes de concluir que falta documentación.

Los resultados sólo orientan la revisión. Iniciar, completar, ver cobertura o abrir un hallazgo no modifica `BudgetItem`. Cualquier corrección del presupuesto requiere una acción humana explícita y debe conservar la decisión y la versión posterior cuando corresponda.

## Migración y despliegue en staging

La migración `20260906150000_add_review_yield_finding` agrega `YIELD_MISMATCH` al enum PostgreSQL `ReviewFindingType`; `20260903130000_add_review_evidence_metadata` agrega `ReviewEvidence.metadataJson`. Antes de promover V1:

1. Restaura un respaldo verificable en staging y ejecuta `npm.cmd run prisma:generate`, `node ./node_modules/prisma/build/index.js validate` y `npx prisma migrate status` con la misma `DATABASE_URL` de staging.
2. Aplica las migraciones con el proceso de despliegue habitual y publica la versión de aplicación que reconoce `YIELD_MISMATCH` en el mismo cambio.
3. Ejecuta una corrida con una fuente completamente procesada y otra con `OCR_REQUIRED` o `FAILED`. Confirma que `progressJson.metrics` incluye las cinco categorías y que `partiallyCoveredSources` cuenta versiones distintas.
4. Revisa en la UI el detalle de rendimiento, especificación y componentes APU, y confirma que no existe mutación automática del presupuesto.

## Observabilidad y rollback

En el despliegue y durante la primera ventana operativa, monitorea estados terminales de `ReviewRun`, `failureCode`, deadlines y reintentos, advertencias de extracción, el porcentaje de fuentes parcialmente cubiertas, las distribuciones de `coverageByCategory` y el volumen de `YIELD_MISMATCH`, `INCOMPLETE_APU` y `MISSING_DOCUMENTATION`. Correlaciona incidentes con `ReviewAuditEvent`, `reviewRunId`, versión de reglas y documento/versiones; no uses solamente el total de hallazgos para interpretar calidad de extracción.

Para rollback, primero detén nuevas corridas y conserva evidencias, hallazgos y auditoría. El valor agregado a un enum de PostgreSQL es una migración hacia adelante: no se elimina manualmente en producción. Vuelve a una versión de aplicación compatible con el enum ampliado y los campos JSON V1, o corrige el incidente con una migración posterior. Antes de revertir el servicio, verifica que la versión objetivo puede leer corridas que ya contengan `YIELD_MISMATCH`; si no, mantén la versión compatible y deshabilita el tipo de hallazgo desde la configuración de nuevas corridas.

## Exclusiones explícitas de V1

- No hay OCR productivo ni interpretación de imágenes escaneadas.
- No hay almacenamiento externo ni URLs permanentes de archivos.
- El endpoint de provenance entrega metadatos y una vista temporal segura; no es un renderer binario con resaltado nativo de PDF/XLSX.
- No hay workers distribuidos, cola externa ni garantía de ejecución fuera del proceso web.
- No se modifica automáticamente ningún `BudgetItem`; toda decisión que pueda cambiar el presupuesto requiere una acción humana explícita.

## Verificación operativa

Antes de publicar cambios del módulo, ejecutar:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run prisma:generate
node ./node_modules/prisma/build/index.js validate
git diff --check
```

`prisma migrate status` requiere `DATABASE_URL`; `migrate diff` puede requerir `shadowDatabaseUrl`. Las migraciones del dominio deben revisarse en una base de staging antes de producción.

## Almacenamiento, OCR y reprocesamiento selectivo

Los originales se guardan mediante `REVIEW_DOCUMENT_STORAGE_DIR`, siempre fuera de `public/`. Configura `REVIEW_DOCUMENT_STORAGE_SIGNING_SECRET` con al menos 16 caracteres. Las vistas binarias usan URLs firmadas de corta duración y vuelven a autorizar empresa, proyecto y versión antes de leer.

El extractor marca cada página PDF como `PROCESSED`, `OCR_REQUIRED` o `FAILED`. Sin proveedor OCR, las páginas escaneadas quedan advertidas y no generan `MISSING_DOCUMENTATION`. No se ejecutan macros VBA, fórmulas externas, scripts, hipervínculos ni enlaces externos de XLSX.

Un editor puede llamar `POST /api/review-documents/:id/reprocess` con `{ "pages": [2, 3] }` o `{ "worksheets": ["Metrados"] }`. La operación conserva evidencia válida, fusiona cobertura, evita duplicados por hash y marca como `STALE` las corridas afectadas.

## Jobs y reintentos

Cada corrida persiste intento, deadline de etapa, próximo reintento y código de fallo. Los reintentos usan backoff determinista, respetan la concurrencia por empresa y reanudan desde el checkpoint sin sobrescribir evidencia ni decisiones históricas.
