# MC Revisión Inteligente V0 — operación final

Los límites se aplican agregados al run antes de extraer: cantidad de archivos, suma de bytes, suma de páginas PDF y suma de hojas XLSX. Un rechazo devuelve `REVIEW_LIMIT_*` y no inicia procesamiento.

La evidencia primaria incluye texto, ubicación verificable (`page` para PDF; `sheet`/`range` para XLSX) y metadata de código, descripción, cantidad, unidad, especificación técnica, disciplina, atributos y componentes APU. PDF sólo lee texto embebido y números; no usa OCR, render ni binarios.

Al crear una corrida se persiste el `BudgetVersionSnapshot` base de cada presupuesto incluido y sus descendientes; los hallazgos conservan `baseSnapshotId`. Un presupuesto nuevo no requiere snapshots previos.

Khipu dispone de `searchProjectEvidence(query, filters, session)`, paginado y tenant-aware. Sólo consulta evidencia persistida, no usa IA y no accede a storage.

Exclusiones V0: OCR, render binario, storage externo y workers distribuidos. La cancelación es cooperativa; no borra resultados parciales ni auditoría.
