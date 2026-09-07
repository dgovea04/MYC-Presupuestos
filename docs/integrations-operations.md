# Operación de integraciones controladas

Las sesiones siguen `DRAFT → STAGED → VALIDATED → PREVIEW_READY → CONFIRMED → APPLIED`. La preview y la validación no escriben presupuestos. La confirmación requiere token y versión esperada; toda aplicación debe crear snapshot y evento auditable antes de exponer el resultado.

Los adaptadores iniciales son `xlsx-csv` y `s10`. Los payloads se identifican por hash SHA-256 y los reintentos por `companyId + requestId`. Para rollback, detener confirmaciones, revisar sesiones `APPLIED` y restaurar el snapshot asociado.
