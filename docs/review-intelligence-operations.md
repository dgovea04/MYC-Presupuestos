# Operación de MC Revisión Inteligente V0

MC Revisión Inteligente V0 compara partidas persistidas del presupuesto con evidencia extraída de documentos PDF y XLSX. El resultado es una corrida auditable: las evidencias, vínculos, hallazgos y decisiones humanas se conservan aunque una corrida pase a `STALE`.

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

Los límites validables de V0 son: 1–10 archivos por corrida, PDF de 1–300 páginas, XLSX de 1–20 hojas y archivos de hasta 50 MB. `tolerancePercent` debe ser un decimal positivo o cero con punto decimal; los cálculos se ejecutan con `decimal.js`.

## Estados y cancelación

- Una corrida sigue las etapas persistidas `validating`, `extracting`, `classifying`, `identifying evidence`, `matching`, `rules`, `prioritizing` y `completed`.
- `POST /api/review-runs/:id/cancel` sólo solicita cancelación. El estado pasa a `CANCEL_REQUESTED`; el worker comprueba la solicitud entre etapas y finaliza como `CANCELLED` sin borrar resultados parciales.
- `STALE` significa que una fuente o configuración cambió después de la corrida. No se deben resolver hallazgos sin reconfirmación cuando la corrida está obsoleta.
- Las invalidaciones registran `ReviewAuditEvent` con `REVIEW_RUN_STALE`, fingerprint, actor cuando existe, entidad afectada, estado anterior y nuevo estado.

## Qué marca una corrida como `STALE`

Se marca la corrida afectada cuando cambia una cantidad, unidad, descripción o APU de partida; se reemplaza o reclasifica una fuente; o cambia la versión de reglas, tipos de hallazgo o tolerancia. La selección se limita al tenant, proyecto y presupuesto relacionados.

## Exclusiones explícitas de V0

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
