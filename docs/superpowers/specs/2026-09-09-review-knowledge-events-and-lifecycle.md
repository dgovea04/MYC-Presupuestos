# Especificación de eventos y lifecycle

## Eventos Review → Knowledge

El mapper de `lib/knowledge/learning-bridge.ts` conservará el evento actual de decisión y añadirá eventos idempotentes para:

| Evento | Condición | Resultado |
|---|---|---|
| `REVIEW_ISSUE_CONFIRMED` | `CONFIRMED_ISSUE` | señal elegible para observación/assertion |
| `REVIEW_ISSUE_REJECTED` | `FALSE_POSITIVE`, `NOT_APPLICABLE`, `VALID_AS_IS` | auditoría; no observation |
| `REVIEW_CORRECTION_CONFIRMED` | `CORRECTED` con versión posterior válida | before/after y observation/APU snapshot |
| `REVIEW_EVIDENCE_CONFIRMED` | link/evidencia confirmado | provenance usable |
| `REVIEW_ITEM_LINK_CONFIRMED` | EntityLink confirmado | candidate mapping |
| `REVIEW_RESOURCE_LINK_CONFIRMED` | recurso canónico confirmado | candidate mapping |
| `REVIEW_PRICE_OBSERVED` | precio estructurado confirmado | PriceObservation |
| `REVIEW_YIELD_OBSERVED` | rendimiento estructurado confirmado | YieldObservation |
| `REVIEW_APU_VERSION_OBSERVED` | APU corregido/versionado | KnowledgeApuVersion |

Cada evento incluye `companyId`, `projectId`, actor, finding/decision, source/evidence, timestamp y `idempotencyKey` derivada de tipo + decisionId + entidad + versión.

## Matriz de resoluciones

- `FALSE_POSITIVE`: registra evento de rechazo; no crea conocimiento derivado.
- `NOT_APPLICABLE`: registra evento; no crea observation.
- `VALID_AS_IS`: registra evento; puede conservar feedback, no cambia presupuesto.
- `NEEDS_MORE_INFORMATION`: evento pendiente; no crea observation.
- `CONFIRMED_ISSUE`: crea sólo observations con datos suficientes.
- `CORRECTED`: exige `correctionVersionId` posterior al snapshot base; conserva before/after.

## Assertion lifecycle

Transiciones válidas:

```text
OBSERVED → CONFIRMED → VERIFIED → CANONICAL
OBSERVED → REJECTED
CONFIRMED → REJECTED | DEPRECATED
VERIFIED → DEPRECATED
```

`GLOBAL` sólo puede ser resultado de promoción manual autorizada, con actor, motivo, evidencia y audit event. Las transiciones inválidas responden error y no escriben parcialmente.

## Provenance completeness

Una observation derivada requiere finding, decision, ReviewEvidence, source document/version, project, company, actor y timestamp. Page/sheet/cell, budget version, canonical id, region y supplier son opcionales sólo si no existen en origen; nunca se inventan.
