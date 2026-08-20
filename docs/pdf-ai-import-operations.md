# Importacion PDF asistida por IA

Guia operativa para configurar y operar el importador de presupuesto, APUs y subpartidas desde PDFs.

## Ruta

- UI: `/imports/pdf`
- Analisis inicial: `POST /api/imports/pdf/analyze`
- Draft revisable: `POST /api/imports/pdf/draft`
- Importacion final: `POST /api/imports/pdf/import`

## Configuracion del proveedor

El importador PDF no requiere variables de entorno para la IA.

1. Ve a `/settings`.
2. Abre la pestaña **IA**.
3. En **Proveedores Cloud IA**, configura y prueba la API key de OpenAI, Gemini u OpenRouter.
4. En **Importador PDF IA**, selecciona el proveedor específico para PDF y guarda.

La selección del importador PDF es independiente del proveedor predeterminado de Khipu Agente. El proveedor elegido se usa tanto para OCR/visión de PDFs escaneados como para la estructuración `pdf_import_structure`.

Las API keys se guardan cifradas en la base de datos. En producción se debe configurar una `ENCRYPTION_KEY` estable para poder descifrarlas.

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

El adaptador de OCR usa el proveedor seleccionado por el usuario: OpenAI Responses, Gemini `generateContent` u OpenRouter Chat Completions. Si falta la API key del proveedor seleccionado, el draft conserva warnings accionables en lugar de inventar datos.

## Troubleshooting

### El PDF aparece como escaneado pero no extrae datos

1. Verifica que la API key del proveedor seleccionado aparezca como configurada en `Configuracion > IA > Proveedores Cloud IA`.
2. Confirma que el proveedor seleccionado en `Importador PDF IA` coincida con la key disponible.
3. En OpenRouter, verifica que el modelo elegido soporte entrada PDF/vision.
4. Revisa que el archivo no exceda limites de tamano/paginas.
5. Prueba clasificar manualmente el PDF como `Presupuesto`, `APU` o `Subpartidas`.
6. Si la calidad visual es baja, pide un PDF digital o una exportacion desde el sistema origen.

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
