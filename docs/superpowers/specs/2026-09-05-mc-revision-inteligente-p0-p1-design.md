# MC Revisión Inteligente P0/P1 — Diseño técnico

**Fecha:** 2026-09-05  
**Estado:** Propuesto para implementación  
**Producto:** MC Presupuestos

## Objetivo

Cerrar los principales desfases de P0/P1 del PRD de MC Revisión Inteligente: almacenamiento seguro de documentos, provenance accesible, detección y procesamiento OCR, operación robusta de jobs, clasificación sugerida y selección explícita de hojas XLSX.

El incremento conservará los guardrails existentes: revisión humana obligatoria, ninguna mutación automática del presupuesto, aislamiento por empresa/proyecto, cálculos determinísticos con `Decimal` e historial auditable.

## Alcance

Incluye:

- interfaz de almacenamiento de documentos con adaptador local persistente y contrato preparado para S3/R2;
- URLs temporales autorizadas para visualizar documentos;
- eliminación de binarios y derivados respetando auditoría mínima;
- detección de páginas PDF sin texto y estado `OCR_REQUIRED`;
- adaptador OCR configurable, aislado del matching y las reglas;
- warnings, confianza y páginas/hojas afectadas persistidos;
- bloqueo de hallazgos de cobertura en zonas no procesadas;
- reintentos con backoff, timeout por etapa y límite de concurrencia por empresa;
- estado de fallo inspeccionable y reprocesamiento selectivo de páginas/hojas;
- clasificación sugerida con confirmación humana;
- selección de hojas XLSX persistida en la configuración del `ReviewRun`;
- pruebas unitarias, de rutas e integración del flujo principal.

No incluye:

- proveedor cloud específico ni despliegue de infraestructura externa;
- interpretación de planos o metrado gráfico;
- mutaciones automáticas de `BudgetItem`;
- embeddings o búsqueda semántica nueva;
- exportación de informes;
- migración a workers distribuidos. El runner local conservará una interfaz sustituible.

## Arquitectura

```text
Upload API
  -> DocumentService
  -> StorageAdapter (local / S3-compatible)
  -> DocumentVersion
  -> ExtractionRouter
       -> Digital PDF/XLSX extractor
       -> OCR adapter for uncovered PDF pages
  -> Evidence persistence
  -> Matching / deterministic rules
  -> Review job runner with retry, timeout and concurrency guard
  -> Review UI / temporary provenance URL
```

### StorageAdapter

```ts
interface ReviewDocumentStorage {
  put(input: {
    companyId: string;
    projectId: string;
    documentVersionId: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ storageKey: string; sha256: string }>;
  createTemporaryReadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
    companyId: string;
    projectId: string;
  }): Promise<{ url: string; expiresAt: Date }>;
  delete(input: { storageKey: string; companyId: string; projectId: string }): Promise<void>;
}
```

El adaptador local almacenará los archivos bajo un directorio configurable fuera de `public/`, usando rutas derivadas de tenant y versión. La API nunca devolverá `storageKey`; sólo devolverá una URL temporal o una vista estructurada autorizada.

## OCR y extracción

La extracción digital se ejecutará primero. Las páginas sin texto suficiente se registrarán como zonas no cubiertas. El router OCR recibirá únicamente esas páginas y devolverá evidencia con:

- `extractionMethod: "OCR"`;
- confianza de extracción;
- página real cuando esté disponible;
- warning si el proveedor no puede procesar una página.

Si OCR no está configurado, el documento podrá finalizar con warnings, pero no se producirán hallazgos de ausencia para esas zonas.

La extracción XLSX aceptará una lista opcional de hojas. Sin selección explícita, la ejecución conservará el comportamiento actual de procesar todas las hojas dentro de los límites configurados.

## Jobs y resiliencia

Cada etapa tendrá un timeout y un número máximo de intentos. Los fallos transitorios se reintentarán con backoff determinístico; los fallos definitivos quedarán inspeccionables en el `ReviewRun` y en auditoría.

La concurrencia se controlará por `companyId`. Un reprocesamiento recibirá una lista de páginas PDF o nombres de hojas XLSX y reutilizará evidencia idempotente sin duplicar hallazgos.

La cancelación seguirá siendo cooperativa. Los resultados parciales no se borrarán.

## Clasificación

El sistema podrá producir una sugerencia de categoría y un score explicable usando nombre, extensión, encabezados y señales de contenido. La sugerencia no cambiará la categoría hasta una confirmación humana. La clasificación confirmada marcará ejecuciones relacionadas como `STALE`.

## Provenance y seguridad

- Todas las lecturas de fuente verificarán empresa, proyecto, versión y permisos.
- Las URLs tendrán expiración corta y no serán permanentes.
- Los archivos permanecerán fuera de `public/`.
- No se ejecutarán macros, fórmulas externas, scripts ni enlaces.
- El adaptador de almacenamiento permitirá integrar malware scanning antes de marcar una versión como procesable.
- La eliminación quitará binario, evidencias y derivados permitidos, conservando sólo auditoría mínima sin contenido original.

## Pruebas

Se aplicará TDD por componente:

- storage: aislamiento, hash, expiración y eliminación;
- OCR: detección de páginas sin texto, warnings y método/confianza;
- jobs: retry, timeout, concurrencia, reprocesamiento e idempotencia;
- clasificación: sugerencia, confirmación y stale;
- XLSX: selección de hojas y ubicación real;
- API/UI: flujo cargar → procesar → revisar → abrir provenance → resolver;
- verificación final: suite específica, suite global, `typecheck`, `lint`, `build` y `git diff --check`.

## Criterios de aceptación

1. Un documento cargado queda almacenado fuera de `public/` y puede abrirse sólo mediante URL temporal autorizada.
2. Un PDF escaneado se identifica como `OCR_REQUIRED` y, con OCR configurado, produce evidencia marcada como OCR.
3. Las páginas/hojas fallidas aparecen como warnings y no alimentan hallazgos de ausencia.
4. Una ejecución no supera el límite de concurrencia por empresa y reintenta fallos transitorios sin duplicar resultados.
5. El usuario puede reprocesar páginas/hojas concretas.
6. El usuario ve y confirma la clasificación sugerida.
7. El usuario puede seleccionar hojas XLSX antes de ejecutar una revisión.
8. Ningún flujo modifica automáticamente el presupuesto.
9. Las decisiones, cambios de clasificación y accesos relevantes quedan auditados.

