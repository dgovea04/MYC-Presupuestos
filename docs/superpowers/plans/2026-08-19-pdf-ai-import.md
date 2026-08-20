# Importacion PDF asistida por IA - Plan de implementacion

> **Para agentes de implementacion:** usar `superpowers:executing-plans` o `superpowers:subagent-driven-development` cuando se ejecute este plan. Las tareas usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Implementar un flujo de importacion asistida por IA para paquetes PDF variados, incluyendo PDFs escaneados, que extraiga presupuesto, APUs y subpartidas, los vincule con trazabilidad y permita importar solo despues de revision humana.

**Especificacion:** `docs/superpowers/specs/2026-08-19-pdf-ai-import-design.md`

**Arquitectura:** Crear un dominio `lib/pdf-import` con extraccion, OCR/vision, estructuracion IA, matching, validacion, preview y persistencia. Reutilizar patrones de importadores existentes, especialmente `lib/s10/import-preview.ts`, `lib/s10/import-persistence.ts`, `ImportProgressPanel` e `ImportWarningSummary`.

**Stack:** Next.js App Router, TypeScript strict, Prisma, PostgreSQL, Zod, `decimal.js`, Vitest, React Testing Library, gateway IA existente y adaptador OCR/vision.

## Restricciones globales

- No usar `any`.
- No persistir datos devueltos por IA sin validacion Zod.
- No guardar importaciones con errores criticos sin aprobacion explicita.
- No confiar en totales de IA; recalcular con `decimal.js`.
- Serializar cantidades y precios como strings en APIs cuando sea necesario.
- No romper importadores S10, RW7, Delphin ni MCP.
- Mantener calculos fuera de UI.
- Mantener route handlers delgados y dominio testeable.
- No loguear texto completo de PDFs ni secretos de proveedor IA.
- La V1 debe ser asistida y auditable, no completamente automatica.

## Estructura de archivos

### Crear

- `app/imports/pdf/page.tsx`
- `components/imports/pdf-importer-page-content.tsx`
- `components/imports/pdf-importer-page-content.test.tsx`
- `app/api/imports/pdf/analyze/route.ts`
- `app/api/imports/pdf/analyze/route.test.ts`
- `app/api/imports/pdf/draft/route.ts`
- `app/api/imports/pdf/draft/route.test.ts`
- `app/api/imports/pdf/import/route.ts`
- `app/api/imports/pdf/import/route.test.ts`
- `lib/pdf-import/types.ts`
- `lib/pdf-import/validation.ts`
- `lib/pdf-import/validation.test.ts`
- `lib/pdf-import/extraction.ts`
- `lib/pdf-import/extraction.test.ts`
- `lib/pdf-import/ocr.ts`
- `lib/pdf-import/page-classifier.ts`
- `lib/pdf-import/page-classifier.test.ts`
- `lib/pdf-import/ai-structure.ts`
- `lib/pdf-import/prompts.ts`
- `lib/pdf-import/linker.ts`
- `lib/pdf-import/linker.test.ts`
- `lib/pdf-import/calculations.ts`
- `lib/pdf-import/calculations.test.ts`
- `lib/pdf-import/warnings.ts`
- `lib/pdf-import/warnings.test.ts`
- `lib/pdf-import/import-preview.ts`
- `lib/pdf-import/import-preview.test.ts`
- `lib/pdf-import/import-persistence.ts`
- `lib/pdf-import/import-persistence.test.ts`
- `test-fixtures/pdf-import/README.md`

### Modificar

- `components/layout/sidebar-nav.tsx` o el archivo donde se declaren accesos de Importacion.
- `app/imports/*` si existe un indice de importadores.
- `lib/ai/gateway/router.ts` si se agrega una tarea IA especifica para OCR/vision o extraccion PDF.
- `lib/ai/validation.ts` si se expone selector de proveedor.
- `lib/billing/entitlements.ts` si se protege por feature premium.
- `README.md` o documentacion operativa si se requiere configurar proveedor OCR/vision.

### No modificar inicialmente

- Servicios de calculo de presupuestos existentes salvo que se reutilicen desde el dominio.
- Exportadores PDF/Excel.
- Importadores S10/RW7/Delphin/MCP.
- Editor APU, excepto si se extrae un componente visual reutilizable sin cambiar comportamiento.

---

## Task 0: Confirmar contratos y limites del MVP

**Archivos:**

- Revisar: `docs/superpowers/specs/2026-08-19-pdf-ai-import-design.md`
- Crear: `lib/pdf-import/types.ts`
- Crear: `lib/pdf-import/validation.ts`
- Crear: `lib/pdf-import/validation.test.ts`

- [ ] Definir `PdfAiImportDraft`, `PdfImportedBudget`, `PdfImportedBudgetItem`, `PdfImportedApu`, `PdfImportedApuRow`, `PdfImportedSubpartida`, `PdfImportedResource`, `PdfImportLink` y `PdfImportValidation`.
- [ ] Definir enums de estado: `MATCHED`, `AMBIGUOUS`, `MISSING_APU`, `MISSING_BUDGET_ITEM`, `UNIT_MISMATCH`, `PRICE_MISMATCH`, `NEEDS_REVIEW`.
- [ ] Definir limites V1: numero de PDFs, tamano total, paginas maximas y formatos aceptados.
- [ ] Escribir schemas Zod para requests y respuestas IA.
- [ ] Testear que cantidades/precios aceptan strings decimales y rechazan valores no numericos.
- [ ] Testear que cada entidad importable requiere evidencia minima: archivo, pagina y confianza.

---

## Task 1: Crear UI base y navegacion

**Archivos:**

- Crear: `app/imports/pdf/page.tsx`
- Crear: `components/imports/pdf-importer-page-content.tsx`
- Crear: `components/imports/pdf-importer-page-content.test.tsx`
- Modificar: navegacion de Importacion correspondiente

- [ ] Crear pagina server que cargue empresas/workspaces disponibles igual que importadores existentes.
- [ ] Crear componente cliente con wizard: Archivos, Analisis, Preview, Revision, Importar.
- [ ] Agregar carga multiple de PDFs con tipo manual por archivo.
- [ ] Agregar seleccion de empresa, moneda y tolerancia de diferencias.
- [ ] Reutilizar `ImportProgressPanel`.
- [ ] Reutilizar `ImportWarningSummary`.
- [ ] Crear estados vacio, cargando, error, exito y revision requerida.
- [ ] Testear que no se puede analizar sin archivos ni empresa.

---

## Task 2: Implementar extraccion PDF y deteccion de escaneados

**Archivos:**

- Crear: `lib/pdf-import/extraction.ts`
- Crear: `lib/pdf-import/extraction.test.ts`
- Crear: `lib/pdf-import/ocr.ts`

- [ ] Implementar lectura de texto embebido por pagina.
- [ ] Implementar heuristica `isScannedPage` basada en densidad de texto, cantidad de numeros y palabras clave.
- [ ] Implementar contrato `OcrProvider` sin acoplarlo a un proveedor especifico.
- [ ] Implementar fallback para paginas que requieren OCR.
- [ ] Normalizar salida por pagina con `pageNumber`, `text`, `tables`, `confidence`, `requiresOcr` y `source`.
- [ ] Testear paginas con texto suficiente.
- [ ] Testear paginas que deben marcarse como escaneadas.
- [ ] Testear que errores OCR se reportan como warnings, no como datos inventados.

---

## Task 3: Clasificar archivos y paginas

**Archivos:**

- Crear: `lib/pdf-import/page-classifier.ts`
- Crear: `lib/pdf-import/page-classifier.test.ts`
- Crear: `lib/pdf-import/prompts.ts`

- [ ] Implementar clasificacion deterministica por palabras clave: presupuesto, analisis de precios unitarios, subpartida, insumos, resumen.
- [ ] Implementar clasificacion IA cuando la deterministica sea ambigua.
- [ ] Respetar etiquetas manuales del usuario como prioridad.
- [ ] Guardar confianza por archivo y por pagina.
- [ ] Generar warnings para archivos no clasificados.
- [ ] Testear mezcla de paginas de presupuesto y APU en un mismo PDF.

---

## Task 4: Estructurar datos con IA

**Archivos:**

- Crear: `lib/pdf-import/ai-structure.ts`
- Modificar: `lib/pdf-import/prompts.ts`
- Crear/Modificar: `lib/pdf-import/validation.ts`
- Crear: tests unitarios con mocks de proveedor IA

- [ ] Crear prompt de extraccion de presupuesto.
- [ ] Crear prompt de extraccion de APUs.
- [ ] Crear prompt de extraccion de subpartidas.
- [ ] Pedir JSON estricto con campos observados y `null` cuando falten datos.
- [ ] Parsear y validar con Zod.
- [ ] Implementar retry de reparacion JSON.
- [ ] Marcar entidades con baja confianza como `needsReview`.
- [ ] Registrar proveedor IA usado y duracion.
- [ ] Testear respuesta valida.
- [ ] Testear respuesta invalida reparable.
- [ ] Testear respuesta invalida no reparable.

---

## Task 5: Normalizar unidades, codigos y descripciones

**Archivos:**

- Crear: `lib/pdf-import/linker.ts`
- Crear: `lib/pdf-import/linker.test.ts`

- [ ] Implementar normalizacion de codigos de partida.
- [ ] Implementar normalizacion de unidades (`m2`, `m3`, `kg`, `glb`, `und`, etc.).
- [ ] Implementar normalizacion de descripcion sin destruir terminos tecnicos.
- [ ] Implementar comparadores de similitud deterministica.
- [ ] Testear equivalencias comunes de unidades.
- [ ] Testear que descripciones tecnicamente distintas no colapsan indebidamente.

---

## Task 6: Vincular presupuesto, APUs y subpartidas

**Archivos:**

- Modificar: `lib/pdf-import/linker.ts`
- Modificar: `lib/pdf-import/linker.test.ts`

- [ ] Vincular presupuesto -> APU por codigo exacto.
- [ ] Vincular presupuesto -> APU por descripcion/unidad.
- [ ] Vincular presupuesto -> APU por descripcion/precio dentro de tolerancia.
- [ ] Detectar `AMBIGUOUS` cuando haya mas de un candidato plausible.
- [ ] Detectar `MISSING_APU` y `MISSING_BUDGET_ITEM`.
- [ ] Detectar `UNIT_MISMATCH`.
- [ ] Detectar `PRICE_MISMATCH`.
- [ ] Vincular lineas APU -> subpartida por descripcion/unidad/precio.
- [ ] Usar IA solo como fallback para casos ambiguos.
- [ ] Testear al menos un caso de subpartida anidada.

---

## Task 7: Recalcular montos y generar advertencias

**Archivos:**

- Crear: `lib/pdf-import/calculations.ts`
- Crear: `lib/pdf-import/calculations.test.ts`
- Crear: `lib/pdf-import/warnings.ts`
- Crear: `lib/pdf-import/warnings.test.ts`

- [ ] Recalcular parciales de presupuesto.
- [ ] Recalcular costos unitarios de APU.
- [ ] Recalcular subtotales de recursos/subpartidas.
- [ ] Comparar total extraido vs total recalculado.
- [ ] Comparar precio unitario de presupuesto vs APU.
- [ ] Generar warnings bloqueantes y no bloqueantes.
- [ ] Testear precision decimal-safe.
- [ ] Testear tolerancias monetarias.

---

## Task 8: Crear preview y endpoints `analyze`/`draft`

**Archivos:**

- Crear: `lib/pdf-import/import-preview.ts`
- Crear: `lib/pdf-import/import-preview.test.ts`
- Crear: `app/api/imports/pdf/analyze/route.ts`
- Crear: `app/api/imports/pdf/analyze/route.test.ts`
- Crear: `app/api/imports/pdf/draft/route.ts`
- Crear: `app/api/imports/pdf/draft/route.test.ts`

- [ ] Implementar `analyze` para validar archivos y devolver clasificacion inicial.
- [ ] Implementar `draft` para ejecutar extraccion, OCR, IA, matching y validaciones.
- [ ] Devolver resumen por presupuesto, APU, subpartida, recurso y warning.
- [ ] Incluir evidencia por archivo/pagina en las entidades visibles.
- [ ] Rechazar usuario no autenticado.
- [ ] Rechazar usuario sin acceso a empresa.
- [ ] Rechazar paquetes que exceden limites.
- [ ] Testear flujo feliz con mocks.
- [ ] Testear errores de proveedor IA/OCR.

---

## Task 9: Implementar revision en UI

**Archivos:**

- Modificar: `components/imports/pdf-importer-page-content.tsx`
- Modificar: `components/imports/pdf-importer-page-content.test.tsx`

- [ ] Mostrar resumen del draft.
- [ ] Mostrar partidas sin APU.
- [ ] Mostrar APUs sin partida.
- [ ] Mostrar diferencias de precio.
- [ ] Mostrar subpartidas ambiguas.
- [ ] Mostrar recursos nuevos.
- [ ] Mostrar paginas OCR de baja confianza.
- [ ] Permitir cambiar estado de un conflicto a aprobado cuando sea seguro.
- [ ] Permitir editar campos puntuales del draft: descripcion, unidad, cantidad, precio y vinculo seleccionado.
- [ ] Recalcular preview en cliente solo para visualizacion y confirmar en backend antes de importar.

---

## Task 10: Persistencia transaccional

**Archivos:**

- Crear: `lib/pdf-import/import-persistence.ts`
- Crear: `lib/pdf-import/import-persistence.test.ts`
- Crear: `app/api/imports/pdf/import/route.ts`
- Crear: `app/api/imports/pdf/import/route.test.ts`

- [ ] Validar sesion, empresa y rol `EDITOR`.
- [ ] Validar que no existan errores criticos pendientes.
- [ ] Crear `Project` con `projectType = "Importado PDF IA"`.
- [ ] Crear presupuesto general y subpresupuestos.
- [ ] Crear niveles y partidas.
- [ ] Crear/reutilizar recursos de empresa.
- [ ] Crear APUs vinculados a partidas.
- [ ] Crear subpartidas como `CatalogPartida`.
- [ ] Crear detalle de subpartidas como `PartidaApuRow`.
- [ ] Guardar filas de APU que usan subpartidas con `ApuResource.catalogPartidaId` y `nestedApuRows`.
- [ ] Ejecutar todo en una transaccion con timeout suficiente.
- [ ] Revalidar caches y rutas igual que otros importadores.
- [ ] Trackear evento `budget_imported` con `import_source = "pdf_ai"`.

---

## Task 11: Fixtures y pruebas end-to-end de dominio

**Archivos:**

- Crear: `test-fixtures/pdf-import/README.md`
- Crear fixtures locales permitidos por licencia o sinteticos.
- Crear/Modificar tests de dominio y API.

- [ ] Crear fixture de PDF digital con presupuesto simple.
- [ ] Crear fixture de PDF escaneado sintetico.
- [ ] Crear fixture de APUs con una subpartida.
- [ ] Crear fixture de APU sin partida.
- [ ] Crear fixture de partida sin APU.
- [ ] Crear fixture con diferencia de precio.
- [ ] Agregar test de importacion completa con mocks de OCR/IA.
- [ ] Agregar test de bloqueo por errores criticos.

---

## Task 12: Documentacion operativa

**Archivos:**

- Modificar: `README.md` o crear documento enlazado desde README.
- Crear: documentacion breve de configuracion OCR/vision si aplica.

- [ ] Documentar variables de entorno necesarias.
- [ ] Documentar limites de archivo/paginas.
- [ ] Documentar politica de revision humana.
- [ ] Documentar que la IA no debe inventar valores faltantes.
- [ ] Documentar troubleshooting para PDFs escaneados de baja calidad.

---

## Verificacion final

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] Tests especificos de `lib/pdf-import`.
- [ ] Tests especificos de `app/api/imports/pdf`.
- [ ] Revision manual de UI en desktop y mobile.
- [ ] Confirmar que S10, RW7, Delphin y MCP no cambiaron comportamiento.

## Riesgos y mitigaciones

- **OCR costoso o lento:** imponer limites y mostrar progreso claro.
- **IA inventa campos:** Zod, evidencia obligatoria, `null` para faltantes y revision humana.
- **PDFs con formatos extremos:** permitir clasificacion manual y conflictos editables.
- **Diferencias financieras:** recalcular todo con `decimal.js` y bloquear inconsistencias criticas.
- **Subpartidas ambiguas:** no importar vinculos ambiguos sin confirmacion.
- **Privacidad:** evitar logs con texto completo y mantener archivos/evidencia bajo controles existentes.

