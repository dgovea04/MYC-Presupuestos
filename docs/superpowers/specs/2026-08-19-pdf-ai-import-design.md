# Importacion PDF asistida por IA - Especificacion de diseno

**Fecha:** 2026-08-19  
**Estado:** Propuesta para implementacion  
**Producto:** MC Presupuestos

## Objetivo

Permitir que la seccion **Importacion** reciba varios PDFs de un mismo proyecto, incluyendo documentos digitales y documentos escaneados convertidos a PDF, y genere un draft revisable de presupuesto, APUs y subpartidas vinculadas antes de persistir datos definitivos.

La promesa de producto no es una importacion 100% automatica. La promesa correcta para la V1 es: **importacion asistida por IA, auditable, corregible y validada antes de guardar**.

## Alcance

### Incluido

1. Nueva entrada en Importacion para "PDF asistido por IA".
2. Carga multiple de PDFs de un mismo proyecto.
3. Clasificacion manual o asistida de cada PDF como presupuesto, APU, subpartidas u otro.
4. Soporte para PDFs con texto embebido y PDFs escaneados.
5. Extraccion por capas: texto/tablas cuando existan, OCR/vision cuando el documento sea imagen.
6. Estructuracion con IA a un contrato JSON validado.
7. Matching entre partidas del presupuesto, APUs y subpartidas.
8. Preview con advertencias, confianza, trazabilidad a archivo/pagina y diferencias calculadas.
9. Revision humana antes de importar.
10. Persistencia transaccional a `Project`, `Budget`, `BudgetLevel`, `BudgetItem`, `Apu`, `ApuResource`, `Resource`, `CatalogPartida` y `PartidaApuRow`.
11. Recalculo decimal-safe de parciales, costos unitarios y totales antes de guardar.
12. Registro de fuente y evidencia suficiente para auditoria funcional.

### Fuera de alcance

- Garantizar precision perfecta en cualquier PDF arbitrario.
- Guardar automaticamente documentos con errores criticos sin revision.
- Reemplazar importadores existentes de S10, RW7, Delphin o MCP.
- Entrenar un modelo propio en la V1.
- Editar visualmente el PDF o hacer anotaciones sobre el archivo original.
- Importar formula polinomica desde estos PDFs en la primera version.
- Inferir metrados avanzados detallados si el PDF solo contiene cantidades resumidas.
- Ejecutar OCR en el navegador.

## Estado actual relevante

El sistema ya cuenta con bases utiles:

- Importadores con patron `draft` e `import` en S10, RW7, Delphin y MCP.
- Componentes compartidos de importacion como `ImportProgressPanel`, `ImportWarningSummary` e `ImportBudgetFooterPreview`.
- Persistencia S10 en `lib/s10/import-persistence.ts`, que ya crea proyecto, presupuestos, niveles, partidas, APUs y recursos.
- Modelos `ApuResource.catalogPartidaId` y `ApuResource.nestedApuRows`, utiles para representar subpartidas dentro de APUs de presupuesto.
- Catalogo de partidas con `CatalogPartida` y `PartidaApuRow`.
- Gateway de IA con proveedores `openai`, `gemini`, `openrouter`, `ollama`, `chatgpt_bridge` y seleccion `auto`.
- Validaciones Zod, TypeScript strict, Prisma y `decimal.js`.

La solucion debe extender estos patrones, no crear una arquitectura paralela.

## Terminologia

- **Paquete PDF:** conjunto de PDFs que pertenecen a un mismo proyecto.
- **Documento de presupuesto:** PDF que contiene estructura de presupuesto, partidas, unidades, metrados, precios unitarios y parciales.
- **Documento APU:** PDF que contiene analisis de precios unitarios por partida.
- **Documento de subpartidas:** PDF que contiene APUs reutilizables que pueden aparecer como lineas dentro de otros APUs.
- **Extraccion:** conversion de PDF/pagina a texto, tablas, imagenes u OCR.
- **Estructuracion:** uso de IA para transformar evidencia extraida en entidades normalizadas.
- **Draft:** resultado intermedio editable y validado antes de persistir.
- **Evidencia:** archivo, pagina, texto bruto, confianza y, cuando exista, posicion de una fila extraida.
- **Vinculo:** relacion propuesta entre presupuesto -> APU, APU -> subpartida o insumo -> recurso.

## Flujo de usuario

1. El usuario entra a `Importacion > PDF asistido por IA`.
2. Selecciona empresa destino.
3. Sube uno o varios PDFs del proyecto.
4. Opcionalmente asigna tipo a cada archivo: presupuesto, APUs, subpartidas u otro.
5. Ejecuta analisis.
6. El sistema muestra progreso: lectura, OCR, clasificacion, estructuracion, vinculacion y validacion.
7. El usuario revisa un preview con resumen y tablas de conflictos.
8. El usuario corrige clasificaciones, vinculos o valores puntuales si hace falta.
9. El sistema recalcula y actualiza warnings.
10. El usuario confirma importacion.
11. El sistema crea el proyecto y muestra links a proyecto, presupuesto general y subpresupuestos.

## Arquitectura propuesta

### Rutas

Crear:

- `app/imports/pdf/page.tsx`
- `app/api/imports/pdf/analyze/route.ts`
- `app/api/imports/pdf/draft/route.ts`
- `app/api/imports/pdf/import/route.ts`

La ruta de UI debe seguir el estilo de los importadores existentes. Los route handlers deben validar sesion, membresia de workspace y limites de plan antes de procesar o persistir.

### Dominio

Crear dominio `lib/pdf-import`:

- `types.ts`: contratos internos.
- `validation.ts`: schemas Zod de request, draft y respuesta IA.
- `extraction.ts`: lectura de PDF digital y deteccion de paginas escaneadas.
- `ocr.ts`: adaptador para OCR/vision.
- `page-classifier.ts`: clasificacion de archivos y paginas.
- `ai-structure.ts`: llamadas IA para convertir evidencia en JSON.
- `linker.ts`: matching presupuesto/APU/subpartida/recurso.
- `calculations.ts`: recalculo decimal-safe y diferencias.
- `warnings.ts`: generacion de advertencias.
- `import-preview.ts`: resumen para UI.
- `import-persistence.ts`: persistencia transaccional.

### Contrato intermedio

El draft debe tener esta forma conceptual:

```ts
type PdfAiImportDraft = {
  source: "PDF_AI";
  project: PdfImportedProject;
  sourceFiles: PdfImportSourceFile[];
  budgets: PdfImportedBudget[];
  apus: PdfImportedApu[];
  subpartidas: PdfImportedSubpartida[];
  resources: PdfImportedResource[];
  links: PdfImportLink[];
  validations: PdfImportValidation[];
  warnings: string[];
};
```

Cada entidad extraida debe incluir:

- `id` estable dentro del draft.
- `sourceFileName`.
- `sourcePage`.
- `rawText`.
- `confidence`.
- `needsReview`.
- `reviewReason` opcional.

Los montos y cantidades deben serializarse como strings en APIs y convertirse a `Decimal` en servicios de dominio.

## Extraccion y OCR

La extraccion se ejecuta por pagina:

1. Intentar texto embebido y tablas.
2. Medir calidad: caracteres utiles, densidad numerica, columnas detectables y palabras clave.
3. Si la pagina no alcanza umbral, tratarla como escaneada.
4. Convertir pagina a imagen para OCR/vision.
5. Guardar resultado normalizado por pagina.

El OCR debe estar detras de un adaptador para permitir cambiar proveedor. La primera implementacion puede usar el proveedor IA cloud configurado para tareas de vision. Si no hay proveedor compatible, el sistema debe fallar con un mensaje accionable antes de crear draft.

## Estructuracion con IA

La IA debe operar con prompts separados:

1. Clasificar archivo/paginas.
2. Extraer presupuesto.
3. Extraer APUs.
4. Extraer subpartidas.
5. Normalizar tablas de recursos.
6. Resolver ambiguedades de vinculos cuando las reglas deterministicas no alcancen.

Todas las respuestas deben pasar por Zod. Si la IA devuelve JSON invalido:

- hacer un retry de reparacion;
- si sigue fallando, marcar el archivo/pagina como no estructurado;
- nunca persistir datos no validados.

Los prompts deben pedir valores exactos observados, no inventados. Cuando un campo no exista debe venir como `null` y generar advertencia.

## Matching y vinculacion

### Presupuesto -> APU

Orden de matching:

1. Codigo exacto normalizado.
2. Codigo parcial + unidad compatible.
3. Descripcion normalizada + unidad compatible.
4. Descripcion + precio unitario dentro de tolerancia.
5. Similitud semantica asistida por IA.

Estados:

- `MATCHED`
- `AMBIGUOUS`
- `MISSING_APU`
- `MISSING_BUDGET_ITEM`
- `UNIT_MISMATCH`
- `PRICE_MISMATCH`
- `NEEDS_REVIEW`

### APU -> subpartida

Una linea de APU se considera subpartida candidata cuando:

- tiene unidad y costo unitario como una partida;
- su descripcion coincide con una subpartida extraida;
- pertenece a un grupo distinto de mano de obra, materiales, equipos o herramientas;
- o la IA la clasifica como subpartida con confianza suficiente.

Al persistir, la linea se guarda como `ApuResource` con `catalogPartidaId` y `nestedApuRows` para conservar el detalle.

### Insumo -> recurso

El matching de recursos debe usar:

- descripcion normalizada;
- unidad;
- categoria;
- codigo si existe;
- IU si aparece;
- precio solo como senal secundaria.

Si no hay match confiable, crear recurso de empresa con `source = "PDF_AI"` y `needsReview` representado en metadata del draft/preview, no como campo permanente nuevo en V1.

## Validaciones

Validaciones criticas que bloquean importacion:

- no hay presupuesto importable;
- no hay empresa destino;
- todas las partidas carecen de cantidad o precio;
- APU vinculado sin costo unitario;
- diferencia APU vs presupuesto supera tolerancia y el usuario no la aprueba;
- subpartida ambigua usada en un APU sin confirmacion;
- moneda incompatible no resuelta;
- JSON IA invalido.

Validaciones no criticas:

- partida sin APU;
- APU sin partida;
- recurso sin codigo;
- pagina OCR de baja confianza;
- total de presupuesto difiere del total recalculado dentro de tolerancia configurable;
- unidad abreviada normalizada automaticamente.

Todas las formulas deben recalcularse con `decimal.js`:

- `partial = quantity * unitPrice`.
- `apu.totalUnitCost = sum(ApuResource.subtotal)`.
- `ApuResource.subtotal = quantity * unitPrice` o formula equivalente si hay cuadrilla/rendimiento.
- `Budget.totalDirectCost = sum(BudgetItem.partial)`.
- GG, utilidad e IGV siguen tasas existentes del usuario/proyecto.

## Persistencia

La importacion final debe ser una transaccion unica.

Crear:

- `Project` con `projectType = "Importado PDF IA"`.
- `Budget` general.
- `Budget` de tipo `SUB_BUDGET` por especialidad o bloque detectado.
- `BudgetLevel` para titulos/subtitulos.
- `BudgetItem` para partidas.
- `Apu` vinculado a cada `BudgetItem` confirmado.
- `ApuResource` para filas de APU.
- `Resource` de empresa para insumos nuevos o reutilizacion de existentes.
- `CatalogPartida` para subpartidas.
- `PartidaApuRow` para el detalle de cada subpartida.

Reutilizar la forma de `lib/s10/import-persistence.ts` donde sea posible. Si se extrae logica comun, hacerlo en un helper de importacion compartido solo cuando reduzca duplicacion real.

## UI

La UI debe ser un wizard operativo, no una landing.

Pasos:

1. **Archivos:** carga multiple, empresa destino, tipo por archivo, moneda y tolerancia.
2. **Analisis:** progreso por etapas y estado por archivo.
3. **Preview:** resumen de proyecto, presupuestos, partidas, APUs, subpartidas, recursos y advertencias.
4. **Revision:** tablas para conflictos y edicion puntual.
5. **Importar:** confirmacion, impacto y links finales.

La revision debe tener vistas:

- Partidas sin APU.
- APUs sin partida.
- Diferencias de precio.
- Subpartidas ambiguas.
- Recursos nuevos.
- Paginas de baja confianza OCR.

La tabla de APUs y subpartidas debe respetar el lenguaje visual del editor APU existente: columnas, densidad, decimales configurados, bordes y encabezados con rendimiento, costo unitario y unidad.

## Seguridad y limites

- Limite inicial recomendado: 10 PDFs, 100 MB total, 300 paginas por paquete.
- Validar extension y MIME.
- No exponer texto completo de documentos en logs.
- Guardar solo evidencia necesaria para revision y depuracion.
- Requerir membresia `EDITOR` para importar.
- Requerir feature `khipu.agent` o equivalente si el procesamiento IA consume capacidades premium.
- Los costos de IA/OCR deben registrarse con el sistema de uso IA existente.

## Observabilidad

Registrar eventos:

- `pdf_import_analyzed`
- `pdf_import_draft_created`
- `pdf_import_imported`
- `pdf_import_failed`

Metricas:

- paginas procesadas;
- paginas OCR;
- partidas detectadas;
- APUs detectados;
- subpartidas detectadas;
- porcentaje de matches automaticos;
- porcentaje de items con revision requerida;
- duracion por etapa;
- proveedor IA usado.

## Pruebas

Pruebas unitarias:

- normalizacion de codigo, descripcion y unidad;
- deteccion de paginas escaneadas;
- validacion Zod de respuestas IA;
- matching presupuesto/APU;
- matching APU/subpartida;
- calculos decimal-safe;
- generacion de warnings.

Pruebas API:

- `analyze` rechaza usuario no autenticado;
- `draft` rechaza archivos invalidos;
- `draft` devuelve preview con warnings;
- `import` requiere empresa y rol `EDITOR`;
- `import` bloquea errores criticos;
- `import` persiste proyecto completo.

Fixtures:

- PDF digital con presupuesto simple.
- PDF escaneado con presupuesto simple.
- PDF de APUs con subpartida.
- Paquete con APU sin partida.
- Paquete con partida sin APU.
- Paquete con diferencia de precio.

## Criterios de aceptacion

1. El usuario puede subir varios PDFs variados de un proyecto.
2. El sistema detecta si necesita OCR para paginas escaneadas.
3. El sistema genera un draft estructurado con presupuesto, APUs y subpartidas.
4. El sistema vincula automaticamente partidas/APUs/subpartidas cuando hay suficiente confianza.
5. El preview muestra conflictos y evidencia por archivo/pagina.
6. La importacion final solo ocurre tras confirmacion.
7. Los datos persistidos recalculan montos con precision decimal.
8. Las subpartidas quedan representadas como catalogo reutilizable y vinculadas dentro de APUs.
9. Los importadores existentes siguen funcionando sin cambios de comportamiento.

