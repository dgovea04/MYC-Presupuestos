# Aprendizaje controlado desde importaciones — Especificación

## Objetivo

Convertir los datos estructurados de proyectos importados en observaciones trazables de MC Knowledge, sin contaminar catálogos ni modificar presupuestos automáticamente. Toda promoción fuera del proyecto debe requerir revisión humana y conservar evidencia del archivo de origen.

## Alcance

Aplica a importaciones S10, MCP, RW7, PDF, SQLite/DB y Delphin. El sistema extraerá o reutilizará los datos que ya produce cada pipeline: partidas, subpartidas, insumos, unidades, precios, rendimientos y composiciones APU cuando estén disponibles.

No incluye embeddings, entrenamiento ML, scraping, recomendaciones automáticas, modificación automática de presupuestos ni promoción automática a GLOBAL.

## Modelo de aprendizaje

Cada dato importado se registra con `scope: PROJECT` y una fuente/evidencia asociada. Los estados son:

- `OBSERVED`: dato extraído del proyecto, aún no validado.
- `REVIEW_REQUIRED`: coincidencia ambigua, unidad incompatible, valor atípico o entidad nueva.
- `CONFIRMED`: usuario autorizado confirmó el dato.
- `VERIFIED`: el dato fue confirmado consistentemente en el mínimo de proyectos configurado.
- `CANONICAL`: administrador lo promovió al catálogo de empresa o global.
- `REJECTED` / `DEPRECATED`: dato descartado o reemplazado; nunca se elimina la historia.

El evento `IMPORT_COMPLETED` seguirá siendo un evento de ciclo de vida. Las observaciones, entidades canónicas y versiones APU serán registros separados, idempotentes y enlazados mediante `KnowledgeSource` y `KnowledgeEvidence`.

## Datos que pueden aprenderse

| Dominio | Datos | Condición mínima |
|---|---|---|
| Partidas | descripción, código, unidad, alias | normalización y evidencia de origen |
| Insumos | descripción, unidad, tipo, alias | match inequívoco o revisión manual |
| Precios | valor, moneda, fecha, región, proveedor | insumo canónico y evidencia |
| Rendimientos | valor, unidad de producción, fecha, región | partida canónica y evidencia |
| APU | rendimiento y composición de recursos | composición completa y revisión |
| Proveniencia | archivo, página, hoja, rango/celda, formato | disponible en el importador |

Las cantidades propias de un presupuesto no se convierten automáticamente en reglas generales. Sirven como contexto de proyecto y como evidencia para una revisión.

## Flujo

```text
Importación exitosa
  → extracción normalizada
  → resolución contra entidades canónicas
  → observaciones PROJECT + source/evidence
  → clasificación de confianza y conflictos
  → bandeja administrativa de revisión
  → confirmar/corregir/rechazar
  → promover a COMPANY o GLOBAL con autorización
```

## Reglas de control

1. Una fila sin evidencia queda `REVIEW_REQUIRED` y no puede promoverse.
2. Un match ambiguo no crea una relación canónica.
3. La unidad debe ser compatible antes de aceptar precios o rendimientos.
4. Los importes se almacenan con Decimal y precisión existente de Knowledge.
5. Las claves idempotentes deben incluir importación, dominio e identificador de origen.
6. Un fallo de Knowledge no debe revertir la importación operativa; debe dejar job reintentable y alerta estructurada.
7. La promoción GLOBAL requiere rol/capacidad administrativa existente y MFA cuando aplique.
8. El retrieval debe respetar scopes y estados; `OBSERVED` no se presenta como dato confirmado sin indicarlo.

## Bandeja de revisión

La bandeja debe permitir filtrar por empresa, proyecto, formato, dominio, estado, confianza, región y conflicto. Cada registro muestra valor observado, valor canónico, diferencia, unidad, fuente, evidencia y actor de la decisión.

Acciones: `confirm`, `correct`, `reject`, `merge alias`, `promote company`, `promote global`. Toda acción genera evento idempotente y no destruye la observación original.

## Criterios de aceptación

- Cada importador en alcance produce observaciones o un resultado explícito de `SKIPPED` con razón.
- Todas las observaciones tienen source, evidencia, scope y clave idempotente.
- Replay de una importación no duplica entidades, evidencia ni observaciones.
- Un dato ambiguo o incompatible queda bloqueado para promoción.
- Solo usuarios autorizados pueden confirmar o promover.
- Un dato confirmado puede recuperarse con su proyecto y su provenance.
- La suite cubre extracción, normalización, conflictos, replay, autorización, promoción y fallos parciales.
