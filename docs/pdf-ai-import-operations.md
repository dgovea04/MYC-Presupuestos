# Importacion PDF asistida por IA

Guia operativa para configurar y operar el importador de presupuesto, APUs y subpartidas desde PDFs.

## Ruta

- UI: `/imports/pdf`
- Analisis inicial: `POST /api/imports/pdf/analyze`
- Draft revisable: `POST /api/imports/pdf/draft`
- Importacion final: `POST /api/imports/pdf/import`

## Variables de entorno

```env
# Requerida para OCR/vision de PDFs escaneados cuando no hay texto embebido suficiente.
OPENAI_API_KEY="sk-..."

# Opcional. Si no se configura, usa OPENAI_MODEL o el modelo por defecto del adaptador.
OPENAI_PDF_OCR_MODEL="gpt-5-mini"
```

El flujo tambien puede estructurar datos con el gateway IA existente mediante la tarea `pdf_import_structure`. La seleccion de proveedor sigue la configuracion del gateway y puede usar `auto`.

## Limites V1

Limites recomendados del paquete PDF:

- hasta 10 PDFs por importacion;
- hasta 100 MB en total;
- hasta 300 paginas por paquete;
- solo archivos `.pdf` con MIME `application/pdf`.

Los documentos fuera de estos limites deben rechazarse antes de generar draft para evitar costos altos de OCR/IA y tiempos de espera largos.

## Politica de revision humana

La V1 es asistida, no automatica.

Antes de persistir, el usuario debe revisar el draft y sus observaciones:

- partidas sin APU;
- APUs sin partida;
- diferencias entre P.U. de presupuesto y costo APU;
- subpartidas ambiguas;
- recursos nuevos;
- paginas OCR o IA de baja confianza.

La importacion final se bloquea si existen validaciones criticas (`severity = "error"`). No se deben persistir datos devueltos por IA sin validacion Zod y sin recalculo decimal-safe.

## Regla de no invencion

Los prompts y parsers deben pedir y aceptar solo valores observados en el documento. Cuando falte un campo:

- la IA debe devolver `null` o un valor vacio equivalente;
- el dominio debe normalizarlo de forma segura;
- el draft debe marcar la entidad con `needsReview` o una validacion;
- nunca se debe inventar cantidad, unidad, precio, rendimiento o vinculo.

## OCR y PDFs escaneados

El extractor intenta primero usar texto embebido. Si la pagina tiene texto insuficiente, baja densidad numerica o pocas palabras clave, se marca como candidata a OCR/vision.

Con `OPENAI_API_KEY` configurado, el adaptador de OCR envia el PDF al endpoint de Responses de OpenAI y espera texto normalizado por pagina. Sin proveedor disponible, el draft conserva warnings accionables en lugar de inventar datos.

## Troubleshooting

### El PDF aparece como escaneado pero no extrae datos

1. Verifica que `OPENAI_API_KEY` exista en el entorno del servidor.
2. Revisa que el archivo no exceda limites de tamano/paginas.
3. Prueba clasificar manualmente el PDF como `Presupuesto`, `APU` o `Subpartidas`.
4. Si la calidad visual es baja, pide un PDF digital o una exportacion desde el sistema origen.

### Hay muchas partidas sin APU

1. Sube tambien los PDFs de analisis de precios unitarios.
2. Revisa si los codigos de partida del presupuesto y APUs usan formatos distintos.
3. Usa la vista de revision para identificar unidades o descripciones incompatibles.

### Hay diferencias de precio

1. El sistema recalcula parciales y costos unitarios con `decimal.js`.
2. Revisa si el PDF incluye rendimiento, cuadrilla o subtotales redondeados.
3. Ajusta la tolerancia solo si la diferencia corresponde a redondeo esperado.

### Subpartidas ambiguas

1. Verifica que el PDF de subpartidas contenga unidad y precio unitario.
2. Revisa descripciones similares con distinta unidad o rendimiento.
3. No importes vinculos ambiguos sin confirmacion humana.

## Observabilidad esperada

Eventos esperados:

- `pdf_import_analyzed`
- `pdf_import_draft_created`
- `pdf_import_imported`
- `pdf_import_failed`

La importacion final ya registra `budget_imported` con `import_source = "pdf_ai"`.

Metricas utiles:

- paginas procesadas;
- paginas OCR;
- partidas detectadas;
- APUs detectados;
- subpartidas detectadas;
- porcentaje de matches automaticos;
- cantidad de observaciones de revision;
- duracion del draft;
- proveedor IA/OCR usado.

## Pruebas

Suite enfocada recomendada:

```powershell
npm.cmd run test -- lib/pdf-import app/api/imports/pdf components/imports/pdf-importer-page-content.test.tsx
```

Fixtures sinteticos:

```text
test-fixtures/pdf-import
```

Estos fixtures representan texto extraido de PDFs digitales u OCR y evitan depender de documentos reales con licencia incierta.
