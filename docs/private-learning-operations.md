# Operación de aprendizaje privado

El aprendizaje privado está desactivado por defecto (`PRIVATE_LEARNING_ENABLED=false`) y se limita al `companyId` autenticado. Solo decisiones confirmadas crean ejemplos; el payload se sanitiza, se deduplica por hash y expira por defecto a los 365 días.

La recuperación solo devuelve ejemplos `ACTIVE`, no expirados y de la misma empresa. Revocar marca el ejemplo inmediatamente como `REVOKED`; ninguna sugerencia modifica automáticamente un presupuesto ni envía datos a proveedores externos.
