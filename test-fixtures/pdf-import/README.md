# PDF AI Import Fixtures

Fixtures sinteticos para pruebas de importacion PDF asistida por IA.

Estos archivos no son PDFs reales ni documentos de terceros. Son texto controlado que representa el contenido extraido de PDFs digitales u OCR, para mantener las pruebas rapidas, deterministicas y sin problemas de licencia.

## Archivos

- `digital-budget-simple.txt`: presupuesto digital con una partida correctamente formada.
- `ocr-budget-low-confidence.txt`: presupuesto simulado desde OCR con evidencia de baja confianza.
- `apu-with-subpartida.txt`: APU con una fila que representa subpartida anidada.
- `apu-without-budget-item.txt`: APU que no tiene partida correspondiente en el presupuesto.
- `budget-without-apu.txt`: partida de presupuesto sin APU.
- `price-mismatch-package.txt`: paquete minimo con diferencia entre precio de presupuesto y costo APU.

## Uso

Las pruebas de dominio pueden leer estos fixtures como texto extraido y construir drafts con `createPdfAiImportDraftFromText` o con mocks de IA/OCR. Cuando se agreguen PDFs binarios reales, deben ser sinteticos o tener licencia explicita para el repositorio.
