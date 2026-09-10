# Task 4 — Informe de implementación

## Estado

Completado directamente en `main`, sin worktree ni subagentes. Task 1–3 permanecen intactas. El directorio preexistente `presupuesto-ejemplo/pdf escaneado/` no fue tocado ni incluido.

## Cambios

- `lib/knowledge/feature-flags.ts`
  - Extendido el registro tipado con `retrievalV1` → `MC_KNOWLEDGE_RETRIEVAL_V1`.
  - `isKnowledgeFeatureEnabled` acepta contexto opcional `{ companyId, projectId }`, preservando el comportamiento actual basado en entorno porque el registro existente no contiene un proveedor de overrides contextual.
  - Los valores solo se habilitan con la cadena exacta `"true"`.
- `app/api/knowledge/retrieval/route.ts`
  - Mantiene la autenticación y autorización de lectura antes de evaluar el flag.
  - Con retrieval deshabilitado responde HTTP 503 con `{ error: "Knowledge retrieval disabled", feature: "retrievalV1" }`.
  - No invoca `retrieveKnowledgeV1` cuando el flag está apagado.
- `app/api/admin/knowledge/queue/route.ts`
  - Requiere `companyId` explícito y conserva `400` para alcance faltante o estado inválido.
  - Valida compañía/proyecto mediante `assertKnowledgeReadAccess` antes del flag y de la consulta de cola.
  - Aplica el mismo 503 controlado y no consulta `getKnowledgeAdminQueue` cuando retrieval está deshabilitado.
  - No habilita ninguna mutación administrativa.
- Pruebas de flags y rutas
  - Cubren habilitación con contexto, 503 sin consulta, orden autorización→flag, cola deshabilitada y alcance requerido.

## TDD

### RED

Se ejecutó primero:

```text
npm.cmd test -- lib/knowledge/feature-flags.test.ts app/api/knowledge/retrieval/route.test.ts app/api/admin/knowledge/queue/route.test.ts
```

Resultado: 3 archivos fallidos, 6 pruebas fallidas y 5 exitosas. Las fallas fueron las esperadas: `retrievalV1` no estaba registrado, las rutas no evaluaban el flag ni protegían la consulta, y la cola no exigía `companyId`.

### GREEN

El mismo comando después de la implementación:

```text
3 archivos pasaron; 11 pruebas pasaron.
```

## Verificación

```text
npm.cmd test -- app/api/knowledge app/api/admin/knowledge lib/knowledge
39 archivos pasaron; 160 pruebas pasaron.

npm.cmd run typecheck
Pasó, exit code 0.

npm.cmd run lint
Pasó sin errores reportados.

git diff --check
Pasó sin errores de whitespace.
```

## Commit

- `feat: gate knowledge retrieval by rollout flag` (hash final entregado en el estado de cierre).

## Concerns

- El registro de flags existente no implementa persistencia ni overrides contextuales por compañía/proyecto; por eso se preserva el fallback de entorno y se propaga el contexto compatible sin inventar un segundo sistema de configuración. Si se requiere precedencia real de overrides, debe definirse primero su fuente y contrato.
- `presupuesto-ejemplo/pdf escaneado/` continúa como cambio no rastreado preexistente y fue excluido del commit.
