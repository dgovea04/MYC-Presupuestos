# PRD — MC Revisión Inteligente

**Producto:** MC Presupuestos  
**Funcionalidad:** MC Revisión Inteligente  
**Versión del documento:** 1.0  
**Estado:** Propuesta para validación  
**Fecha:** 2026-09-02  
**Mercado inicial:** Perú  
**Idioma inicial:** Español  
**Responsable de producto:** Mercado y Construcción  

---

## 1. Resumen ejecutivo

MC Revisión Inteligente será una funcionalidad integrada en MC Presupuestos que permitirá contrastar un presupuesto con los documentos técnicos de su proyecto. El sistema extraerá información de archivos PDF y XLSX, relacionará evidencias con partidas, ejecutará verificaciones determinísticas y presentará una bandeja priorizada de elementos que requieren revisión humana.

La propuesta no es “conversar con un PDF”. Es convertir documentos dispersos en evidencia verificable alrededor de la estructura que MC Presupuestos ya conoce:

> Proyecto → Presupuesto → Subpresupuesto → Partida → Metrado → APU → Recursos.

La primera versión se concentrará en cinco clases de hallazgos:

1. diferencia de metrado;
2. unidad potencialmente inconsistente;
3. especificación técnica potencialmente incompatible;
4. partida sin documentación relacionada con confianza suficiente;
5. APU potencialmente incompleto.

Cada hallazgo deberá mostrar su documento, página u hoja, ubicación, fragmento y nivel de confianza. Ninguna corrección se aplicará automáticamente. El ingeniero conservará el control y podrá confirmar, corregir, descartar o solicitar más información.

El producto combina cinco capacidades:

- modelo estructurado de costos y construcción;
- inteligencia documental;
- relaciones semánticas entre documentos y partidas;
- reglas y cálculos determinísticos;
- asistencia contextual mediante Khipu, siempre supervisada.

---

## 2. Contexto y oportunidad

Los profesionales de costos y oficinas técnicas suelen trabajar con información fragmentada entre presupuestos, hojas de metrados, especificaciones, APU, memorias y expedientes extensos. Revisar la coherencia entre esas fuentes requiere horas de búsqueda, comparación y validación manual.

MC Presupuestos ya estructura una parte central del problema: presupuestos, partidas, APU, recursos y metrados. Revisión Inteligente extiende esa estructura hacia los documentos del proyecto y crea un puente verificable entre ambos mundos.

La oportunidad estratégica no consiste en competir únicamente con otra pantalla para crear APU. Consiste en reducir trabajo cognitivo:

- localizar información relevante;
- relacionarla con la partida correcta;
- comparar datos equivalentes;
- detectar discrepancias potenciales;
- priorizar lo económicamente importante;
- mostrar de dónde provino cada conclusión;
- registrar la decisión del profesional.

Esta funcionalidad constituye el primer paso práctico hacia la visión de Mercado y Construcción:

> Base estructurada de conocimiento de construcción peruana + motor determinístico de cálculos + IA + interoperabilidad + trazabilidad de fuentes.

---

## 3. Definición del producto

### 3.1 Declaración del producto

> MC Revisión Inteligente es un sistema de revisión asistida que cruza automáticamente un presupuesto con los documentos técnicos del proyecto, identifica información relacionada, detecta posibles inconsistencias y presenta cada hallazgo junto con su evidencia para que un ingeniero lo valide.

### 3.2 Propuesta de valor

**Para** ingenieros de costos, presupuestistas, consultores y oficinas técnicas  
**que** revisan manualmente la coherencia de presupuestos y expedientes  
**MC Revisión Inteligente** relaciona partidas, metrados, especificaciones y APU  
**para** concentrar la atención en posibles discrepancias de mayor relevancia  
**a diferencia de** un chat documental genérico  
**porque** cada resultado está ligado al modelo técnico de MC Presupuestos, usa cálculos determinísticos y muestra evidencia verificable.

### 3.3 Principios del producto

1. **Evidencia antes que afirmación.** Ningún hallazgo llega a la bandeja sin una fuente verificable.
2. **Asistencia, no sustitución.** El sistema recomienda; el profesional decide.
3. **IA para interpretar; código para calcular.** Los cálculos y comparaciones numéricas se ejecutan de forma determinística.
4. **Incertidumbre visible.** Se muestran confianza, limitaciones y casos ambiguos.
5. **Integrado al trabajo real.** El usuario revisa dentro del proyecto y del presupuesto, no en una herramienta aislada.
6. **Compatible con los archivos actuales.** La adopción comienza con PDF y Excel.
7. **Aprendizaje estructurado.** Aceptaciones, correcciones y descartes generan eventos auditables.
8. **Aislamiento por empresa.** El conocimiento privado nunca se mezcla entre organizaciones sin autorización explícita.

---

## 4. Objetivos

### 4.1 Objetivo principal del MVP

Permitir que un ingeniero cargue documentos reales de un proyecto, obtenga relaciones útiles entre partidas y fuentes, revise un conjunto reducido de inconsistencias y pueda verificar cada hallazgo directamente contra su evidencia.

### 4.2 Objetivos de producto

- Reducir el tiempo dedicado a buscar y comparar información.
- Aumentar la cobertura y consistencia de la revisión técnica.
- Ofrecer trazabilidad completa para cada hallazgo.
- Priorizar elementos por severidad, confianza e impacto potencial.
- Convertir decisiones humanas en feedback estructurado.
- Validar la disposición de usuarios reales a usar y pagar por este workflow.

### 4.3 Objetivos técnicos

- Introducir `Document`, `Evidence`, `EntityLink`, `ReviewRun` y `Finding` como conceptos de primer nivel.
- Separar extracción, matching, cálculo y explicación en servicios independientes.
- Ejecutar análisis largos de manera asíncrona, reanudable e idempotente.
- Mantener versionadas las entradas y reglas que originaron cada hallazgo.
- Preparar la arquitectura para futuros documentos, reglas e integraciones sin incorporarlos al MVP.

### 4.4 No objetivos del MVP

El MVP no pretende:

- interpretar DWG, RVT o IFC;
- medir automáticamente planos;
- generar un presupuesto completo desde cero;
- modificar partidas, metrados o APU sin aprobación;
- certificar conformidad normativa o contractual;
- reemplazar la revisión de un ingeniero colegiado;
- garantizar que la ausencia de evidencia equivale a ausencia en el expediente;
- entrenar modelos con información privada de clientes;
- sustituir S10, Delphin, Excel, Project o sistemas BIM;
- analizar todo tipo de expediente de 300 páginas con exactitud uniforme desde el primer lanzamiento.

---

## 5. Usuarios objetivo

### 5.1 Usuario primario: ingeniero de costos o presupuestista

**Trabaja con:** presupuestos, APU, metrados, Excel, S10, Delphin y expedientes.  
**Problema:** compara información repetidamente y puede omitir discrepancias en archivos extensos.  
**Valor esperado:** una lista confiable y priorizada de elementos para revisar.

### 5.2 Usuario secundario: consultor que elabora o revisa expedientes

**Trabaja con:** múltiples versiones de documentos, entregables y observaciones.  
**Problema:** demostrar coherencia y sustentar observaciones consume tiempo.  
**Valor esperado:** evidencia trazable y registro de decisiones.

### 5.3 Usuario secundario: oficina técnica de constructora

**Trabaja con:** presupuesto contractual, metrados, especificaciones y cambios.  
**Problema:** la información se distribuye entre personas y repositorios.  
**Valor esperado:** una revisión compartida, auditable y centrada en partidas.

### 5.4 Administrador de empresa

**Necesita:** controlar acceso, consumo, retención y uso de IA.  
**Valor esperado:** aislamiento de datos, permisos, historial y políticas claras.

---

## 6. Jobs to be Done

1. Cuando recibo un presupuesto y documentos de respaldo, quiero saber qué partidas tienen fuentes relacionadas para revisar el expediente sin buscar página por página.
2. Cuando un metrado aparece en más de una fuente, quiero ver sus diferencias y el cálculo exacto para decidir cuál es válido.
3. Cuando una especificación contradice la descripción de una partida, quiero ver ambos valores junto con la fuente para evaluar el riesgo.
4. Cuando el sistema no logra vincular una partida, quiero saber que la búsqueda fue insuficiente, sin que afirme incorrectamente que la información no existe.
5. Cuando cierro un hallazgo, quiero registrar mi decisión y comentario para conservar trazabilidad.
6. Cuando priorizo mi trabajo, quiero empezar por los hallazgos con mayor impacto potencial y mejor evidencia.
7. Cuando uso Khipu, quiero consultar y filtrar resultados existentes sin que el asistente invente o modifique datos.

---

## 7. Alcance funcional del MVP V0

### 7.1 Entradas admitidas

| Entrada | Requisito V0 | Observaciones |
|---|---:|---|
| Presupuesto existente en MC | Obligatorio | Es la estructura base de comparación. |
| PDF con texto seleccionable | Admitido | Memoria, especificaciones, metrados o APU. |
| PDF escaneado | Admitido con OCR | Se identifica como OCR y puede tener menor confianza. |
| XLSX de metrados | Opcional | El usuario selecciona o confirma hojas relevantes. |
| XLSX de presupuesto/APU | Opcional | Sólo si existe importación compatible. |
| CSV | Fuera de V0 | Candidato inmediato para V0.1. |
| Planos PDF | Almacenables, no interpretados | Sólo texto extraíble; no metrado gráfico. |

### 7.2 Límites operativos iniciales

Los siguientes valores son límites de producto configurables, no garantías permanentes:

- máximo 10 archivos por revisión;
- máximo 300 páginas PDF acumuladas por revisión piloto;
- máximo 50 MB por archivo;
- máximo 20 hojas XLSX acumuladas;
- un presupuesto objetivo por ejecución;
- una ejecución activa por presupuesto en V0;
- archivos protegidos por contraseña no se procesan;
- macros y fórmulas externas de Excel no se ejecutan.

Si se excede un límite, la interfaz deberá explicarlo antes de iniciar el análisis y permitir reducir la selección.

### 7.3 Salidas

- inventario y estado de documentos;
- clasificación sugerida de documentos y secciones;
- relaciones entre partidas y evidencias;
- dashboard de cobertura;
- bandeja de hallazgos;
- comparador presupuesto ↔ documento;
- visor de evidencia;
- estado y decisión de cada hallazgo;
- resumen de revisión exportable en una versión posterior al V0;
- interacción contextual con Khipu limitada a consultas sobre resultados persistidos.

---

## 8. Flujo principal de usuario

### Paso 1 — Abrir Revisión Inteligente

Dentro de un presupuesto, el usuario accede a **Revisión inteligente**. La pantalla explica que el análisis compara el presupuesto actual con documentos del proyecto y que todo resultado requiere revisión humana.

### Paso 2 — Agregar documentos

El usuario carga o selecciona PDF/XLSX. Antes de confirmar, ve:

- nombre;
- tipo;
- tamaño;
- páginas u hojas;
- estado de validación;
- advertencias;
- versión o fecha de carga.

### Paso 3 — Procesar y clasificar

El sistema extrae texto y tablas, aplica OCR cuando corresponde y propone categorías:

- memoria descriptiva;
- especificaciones técnicas;
- metrados;
- presupuesto;
- APU;
- cronograma;
- anexos;
- desconocido.

El usuario puede corregir la categoría del documento o de un rango de páginas/hojas.

### Paso 4 — Configurar la revisión

El usuario confirma:

- presupuesto objetivo;
- documentos incluidos;
- tipos de hallazgos a ejecutar;
- tolerancia de metrado, con valor recomendado por defecto;
- si se usará OCR en páginas sin texto;
- aceptación del consumo estimado cuando aplique.

### Paso 5 — Ejecutar análisis

La revisión se procesa en segundo plano. La interfaz muestra etapas y progreso:

1. validando archivos;
2. extrayendo contenido;
3. clasificando secciones;
4. identificando evidencias;
5. relacionando partidas;
6. ejecutando reglas;
7. priorizando hallazgos;
8. completado con o sin advertencias.

El usuario puede abandonar la pantalla y regresar sin perder progreso.

### Paso 6 — Revisar resumen

El dashboard muestra:

- partidas incluidas;
- partidas con alguna evidencia relacionada;
- partidas con metrado relacionado;
- partidas con especificación relacionada;
- vínculos de confianza alta, media y baja;
- hallazgos pendientes por prioridad y tipo;
- advertencias de procesamiento;
- fecha y versión del presupuesto analizado.

### Paso 7 — Resolver hallazgos

El usuario abre un hallazgo y ve:

- datos actuales de MC Presupuestos;
- datos extraídos;
- comparación determinística;
- fragmento de evidencia;
- fuente exacta;
- confianza del vínculo y de la extracción;
- explicación breve de Khipu;
- impacto potencial cuando sea calculable;
- acciones permitidas.

### Paso 8 — Registrar decisión

El usuario elige una resolución y puede agregar comentario. Si decide editar el presupuesto, se abre el flujo normal de edición; la modificación no ocurre dentro del hallazgo de forma silenciosa.

### Paso 9 — Cerrar la revisión

Cuando no quedan hallazgos pendientes, el usuario puede marcar la ejecución como revisada. Cerrar no implica certificación técnica ni impide reabrirla.

---

## 9. Estados de documentos y ejecuciones

### 9.1 Estados de documento

`UPLOADED → VALIDATING → READY → PROCESSING → PROCESSED`

Estados alternos:

- `REJECTED`: formato, contraseña, corrupción o límite no permitido;
- `PROCESSING_FAILED`: falló una etapa recuperable o definitiva;
- `PARTIALLY_PROCESSED`: algunas páginas/hojas no pudieron procesarse;
- `SUPERSEDED`: existe una versión posterior elegida por el usuario;
- `DELETED`: eliminación lógica conforme a retención y auditoría.

### 9.2 Estados de revisión

`DRAFT → QUEUED → RUNNING → COMPLETED → UNDER_REVIEW → REVIEWED`

Estados alternos:

- `COMPLETED_WITH_WARNINGS`;
- `FAILED`;
- `CANCEL_REQUESTED`;
- `CANCELLED`;
- `STALE`, si cambió el presupuesto o una fuente relevante después del análisis.

### 9.3 Reglas de obsolescencia

Una revisión se marca `STALE` cuando:

- cambia el metrado, unidad, descripción o APU de una partida analizada;
- se reemplaza o reclasifica un documento utilizado;
- cambia la versión de una regla con efecto material;
- cambia una tolerancia que afectaría el resultado.

Los hallazgos históricos se conservan; una nueva ejecución crea resultados nuevos y no sobrescribe la evidencia previa.

---

## 10. La evidencia como unidad fundamental

### 10.1 Regla obligatoria

> Todo hallazgo publicado en la bandeja debe tener al menos una evidencia primaria accesible.

Una recomendación genérica de Khipu sin evidencia puede mostrarse en un espacio exploratorio, pero no se registra como hallazgo técnico del MVP.

### 10.2 Datos mínimos de Evidence

- proyecto y empresa;
- documento y versión;
- página o hoja;
- rango de celdas, fila o posición en página cuando esté disponible;
- sección detectada;
- fragmento original;
- texto normalizado;
- tipo de evidencia;
- valor y unidad extraídos, cuando aplique;
- método de extracción;
- confianza de extracción;
- fecha de procesamiento;
- hash del contenido de origen.

### 10.3 Tipos iniciales

- `MEASUREMENT`;
- `TECHNICAL_SPECIFICATION`;
- `APU_COMPONENT`;
- `ITEM_REFERENCE`;
- `GENERAL_REQUIREMENT`;
- `UNKNOWN`.

### 10.4 Provenance visible

La interfaz deberá mostrar un texto como:

> Especificaciones_Tecnicas.pdf · página 94 · sección 03.02 Concreto estructural

En Excel:

> Metrados.xlsx · hoja Estructuras · celda/rango H183:J183

Cuando el sistema sólo pueda identificar la página o la hoja, deberá mostrar esa precisión limitada sin inventar una ubicación más exacta.

---

## 11. Relación entre partidas y documentos

### 11.1 Objeto EntityLink

Un `EntityLink` conecta una entidad de MC —inicialmente una partida— con una o más evidencias.

Debe almacenar:

- entidad MC y versión;
- evidencia;
- tipo de relación;
- método de matching;
- señales utilizadas;
- puntuación global;
- nivel de confianza;
- estado de validación humana;
- autor de la validación;
- fecha;
- modelo, prompt o algoritmo que intervino.

### 11.2 Señales de matching

- código de partida;
- similitud de descripción;
- disciplina o especialidad;
- unidad compatible;
- material o elemento constructivo;
- resistencia, diámetro u otros atributos técnicos;
- jerarquía del presupuesto;
- encabezados de sección;
- proximidad tabular;
- referencias cruzadas;
- coincidencias confirmadas previamente dentro de la misma empresa.

### 11.3 Niveles de confianza

| Nivel | Uso |
|---|---|
| Alta | Puede alimentar reglas y hallazgos automáticamente, manteniendo revisión humana. |
| Media | Puede alimentar hallazgos si la evidencia es clara; se destaca la incertidumbre. |
| Baja | Se presenta como candidato para vinculación manual; no genera una afirmación de inconsistencia. |

Los umbrales numéricos deben ser configurables y calibrados con expedientes reales. No se fijarán como promesa comercial antes del piloto.

### 11.4 Validación manual

El usuario puede:

- confirmar vínculo;
- rechazar vínculo;
- elegir otra evidencia candidata;
- crear un vínculo manual;
- indicar que no aplica.

Estas decisiones no reentrenan automáticamente un modelo global. Generan eventos separados y auditables.

---

## 12. Tipos de hallazgo V0

### 12.1 Diferencia de metrado

**Objetivo:** comparar el metrado de una partida con un valor relacionado en una planilla o documento.

**Precondiciones:**

- vínculo con confianza suficiente;
- valores numéricos legibles;
- unidades iguales o conversión determinística autorizada;
- evidencia primaria disponible.

**Cálculos:**

```text
diferencia_absoluta = valor_documento - valor_presupuesto
diferencia_porcentual = abs(diferencia_absoluta) / abs(valor_presupuesto) × 100
impacto_potencial = diferencia_absoluta × precio_unitario
```

Si el valor base es cero, no se calcula porcentaje y se explica el motivo.

**Tolerancia recomendada inicial:** mayor entre 0.01 de la unidad o 1% del metrado del presupuesto. Debe poder configurarse por empresa o ejecución.

**Severidad sugerida:** se calcula a partir de diferencia porcentual, impacto potencial y confianza; nunca sólo por el texto generado por IA.

**Acciones:** revisar evidencia, confirmar discrepancia, marcar como válida, editar partida mediante el editor normal, solicitar más información o descartar.

### 12.2 Unidad potencialmente inconsistente

**Objetivo:** detectar diferencias entre la unidad de una partida y la unidad presente en una fuente relacionada.

**Ejemplo:** partida de limpieza superficial en `M3` y planilla relacionada en `M2`.

**Reglas:**

- normalizar mayúsculas, variantes y símbolos;
- reconocer equivalencias seguras como `m²`, `M2` y `m2`;
- no convertir área a volumen sin datos dimensionales y una regla explícita;
- no declarar “error”; usar “unidad para revisar”.

**Acciones:** confirmar, justificar, corregir en el editor, relacionar otra fuente o descartar.

### 12.3 Especificación técnica potencialmente incompatible

**Objetivo:** comparar atributos técnicos explícitos de una partida con una especificación relacionada.

**Atributos iniciales candidatos:**

- resistencia de concreto;
- diámetro;
- espesor;
- dosificación;
- tipo o clase de material;
- norma o grado cuando el patrón sea inequívoco.

**Ejemplo:** `f'c=210 kg/cm²` en la partida y `f'c=280 kg/cm²` en la especificación.

**Reglas:**

- comparar valores normalizados mediante código;
- conservar ambos textos originales;
- requerir evidencia con contexto suficiente;
- no inferir que una especificación general aplica a todos los elementos;
- degradar confianza si existen varias secciones candidatas contradictorias.

### 12.4 Partida sin documentación relacionada con confianza suficiente

**Objetivo:** señalar falta de cobertura documental detectable.

**Mensaje obligatorio:**

> No encontramos documentación relacionada con suficiente confianza.

**Mensaje prohibido:**

> La especificación no existe.

**Precondiciones:** procesamiento completo o advertencias visibles; búsqueda en todas las fuentes incluidas; umbral mínimo configurado.

**Acciones:** buscar manualmente, vincular evidencia, excluir del alcance, solicitar más información o mantener pendiente.

### 12.5 APU potencialmente incompleto

**Objetivo:** detectar actividades o componentes mencionados en una especificación pero no representados de forma evidente en el APU relacionado.

**Ejemplo:** la especificación menciona vibrado mecánico, pero no se relaciona equipo, recurso o servicio equivalente en el APU.

**Condiciones especiales:**

- es el hallazgo más interpretativo y se lanzará inicialmente como beta;
- requiere evidencia de especificación y estructura completa del APU;
- debe considerar recursos compuestos o servicios que ya incluyan la actividad;
- nunca agregará recursos automáticamente;
- se calibrará con feedback `NOT_APPLICABLE` y `FALSE_POSITIVE`.

---

## 13. Priorización de hallazgos

### 13.1 Factores

- confianza de evidencia;
- confianza del vínculo;
- severidad técnica;
- impacto económico potencial;
- magnitud relativa;
- recurrencia en varias partidas;
- estado de revisión;
- calidad o completitud del procesamiento.

### 13.2 Modelo inicial

El sistema calculará un `priorityScore` determinístico y versionado. La IA puede explicar la prioridad, pero no asignarla libremente.

```text
priorityScore =
  evidenceFactor
  × linkFactor
  × technicalSeverityFactor
  × impactFactor
```

El resultado se transforma en `HIGH`, `MEDIUM` o `LOW`. Si no hay precio unitario o el impacto no es calculable, el hallazgo puede priorizarse con severidad técnica y confianza, mostrando “impacto no calculado”.

### 13.3 Orden por defecto

1. prioridad alta;
2. impacto potencial descendente;
3. confianza descendente;
4. código de partida.

El usuario puede filtrar por tipo, disciplina, subpresupuesto, estado, prioridad, confianza y documento.

---

## 14. Estados y resoluciones de hallazgo

### 14.1 Estado de trabajo

- `PENDING`;
- `IN_REVIEW`;
- `RESOLVED`;
- `REOPENED`;
- `STALE`.

### 14.2 Resolución humana

- `CONFIRMED_ISSUE`;
- `CORRECTED`;
- `VALID_AS_IS`;
- `FALSE_POSITIVE`;
- `NOT_APPLICABLE`;
- `NEEDS_MORE_INFORMATION`.

### 14.3 Reglas

- Resolver requiere identidad del usuario y fecha.
- `FALSE_POSITIVE`, `NOT_APPLICABLE` y `VALID_AS_IS` permiten comentario opcional, recomendado.
- `CORRECTED` debe guardar referencia a la versión de la entidad posterior a la corrección.
- La reapertura conserva todas las decisiones previas.
- Un cambio automático nunca puede producir `CORRECTED`.

---

## 15. Experiencia de usuario

### 15.1 Navegación

Revisión Inteligente vivirá dentro del contexto del presupuesto:

```text
Proyecto
├── Presupuesto
├── APU
├── Metrados
├── Cronograma
├── Reportes
└── Revisión inteligente
```

No se presentará inicialmente como un SaaS o repositorio separado.

### 15.2 Pantalla vacía

Debe incluir:

- explicación de una frase;
- formatos admitidos;
- aviso de revisión humana;
- CTA “Agregar documentos”;
- CTA secundario “Cómo funciona”.

### 15.3 Gestor de documentos

Lista de archivos con clasificación, versión, progreso, advertencias y acciones. Reemplazar un archivo crea una versión nueva; no destruye la utilizada en revisiones históricas.

### 15.4 Dashboard de revisión

Debe responder rápidamente:

- ¿qué se analizó?;
- ¿qué cobertura se logró?;
- ¿qué requiere atención?;
- ¿qué falló o quedó incompleto?;
- ¿qué cambió desde la última ejecución?

Usar “elementos que requieren revisión”, no “errores encontrados”, salvo que el usuario ya haya confirmado el problema.

### 15.5 Bandeja de revisión

Cada tarjeta muestra:

- tipo y prioridad;
- partida;
- comparación resumida;
- impacto cuando exista;
- fuente;
- confianza;
- estado;
- CTA “Revisar”.

Debe permitir selección y marcado masivo únicamente para acciones no destructivas, como asignar revisor o marcar `NEEDS_MORE_INFORMATION`. No se permite corregir o descartar masivamente en V0.

### 15.6 Detalle de hallazgo

Diseño de dos paneles:

- izquierda: datos actuales de MC Presupuestos;
- derecha: documento y evidencia;
- inferior o lateral: explicación, confianza, impacto, historial y acciones.

La comparación debe seguir siendo comprensible aunque Khipu no esté disponible.

### 15.7 Visor de evidencia

Para PDF:

- abrir en página exacta;
- resaltar bounding box cuando exista;
- mostrar fragmento extraído;
- permitir cambiar página y volver al hallazgo.

Para Excel:

- mostrar hoja y rango;
- vista tabular segura, sin ejecutar macros;
- resaltar fila/celdas de origen;
- conservar valores originales y normalizados.

### 15.8 Accesibilidad y responsive

- Navegación y acciones principales mediante teclado.
- No comunicar severidad sólo con color.
- Etiquetas legibles para lectores de pantalla.
- Contraste WCAG AA.
- Desktop como experiencia principal del comparador.
- En móvil se permite revisar resúmenes y estados; la comparación detallada puede apilar paneles.

---

## 16. Rol de Khipu

Khipu será la interfaz conversacional y explicativa de la capa de inteligencia, no la fuente de verdad.

### 16.1 Funciones admitidas en V0

- resumir una ejecución terminada;
- filtrar hallazgos mediante herramientas autorizadas;
- explicar una comparación ya calculada;
- localizar hallazgos por partida, tipo o disciplina;
- indicar qué evidencia sustenta un hallazgo;
- responder preguntas sobre documentos usando citas;
- reconocer cuando la evidencia no es suficiente.

### 16.2 Funciones prohibidas en V0

- escribir directamente en tablas de presupuesto;
- inventar precios, metrados o rendimientos exactos;
- cerrar hallazgos sin acción explícita del usuario;
- elevar un texto sin fuente a hallazgo oficial;
- ocultar incertidumbre;
- sustituir cálculos determinísticos;
- afirmar conformidad legal, normativa o contractual definitiva.

### 16.3 Herramientas conceptuales

```typescript
getReviewSummary(reviewRunId)
listFindings(filters)
getFinding(findingId)
getEvidence(evidenceId)
searchProjectEvidence(query, filters)
calculateFindingImpact(findingId)
recordFindingDecision(input) // exige confirmación explícita
```

Toda herramienta valida empresa, proyecto, usuario y permisos en servidor. El LLM no recibe acceso directo a la base de datos.

---

## 17. Arquitectura funcional

### 17.1 Componentes

#### MC Presupuestos Domain Model

Fuente autoritativa de proyectos, presupuestos, partidas, metrados, APU y recursos.

#### Document Service

Gestiona carga, validación, versiones, almacenamiento, estado y retención.

#### Extraction Pipeline

Extrae texto, tablas, OCR, coordenadas y estructura básica. Produce contenido normalizado sin decidir si existe una inconsistencia.

#### Classification Service

Clasifica documentos, páginas, secciones y hojas. Las predicciones son editables.

#### Evidence Service

Crea y consulta evidencias inmutables vinculadas a una versión de documento.

#### Matching Engine

Relaciona partidas y evidencias mediante señales léxicas, estructurales, semánticas y técnicas.

#### Deterministic Validation Engine

Normaliza unidades, compara números, aplica tolerancias, calcula diferencias e impacto y ejecuta reglas versionadas.

#### Review Engine

Orquesta reglas, crea hallazgos, asigna prioridad y mantiene su ciclo de vida.

#### Khipu Tool Layer

Expone consultas y acciones limitadas, validadas y auditadas.

#### Job Orchestrator

Ejecuta tareas largas, reintentos, cancelación, checkpoints e idempotencia.

#### Audit & Knowledge Events

Registra decisiones humanas y eventos que podrán alimentar conocimiento privado o curado en fases futuras.

### 17.2 Flujo de datos

```text
PDF / XLSX
    ↓
validación y versionado
    ↓
extracción / OCR / tablas
    ↓
clasificación estructural
    ↓
Evidence
    ↓
matching con partidas MC
    ↓
EntityLink
    ↓
reglas determinísticas
    ↓
Finding + prioridad + impacto
    ↓
bandeja de revisión
    ↓
decisión humana
    ↓
AuditEvent + KnowledgeEvent
```

### 17.3 Separación obligatoria

| Pregunta | Responsable |
|---|---|
| ¿Qué dice el documento? | Extraction / Document Intelligence |
| ¿Con qué partida se relaciona? | Matching Engine |
| ¿Los valores son equivalentes o diferentes? | Deterministic Engine |
| ¿Qué debe revisar el usuario primero? | Review Engine |
| ¿Cómo se explica o consulta? | Khipu |
| ¿Qué decisión se toma? | Usuario autorizado |

---

## 18. Modelo de datos conceptual

### 18.1 ProjectDocument

```typescript
interface ProjectDocument {
  id: string;
  companyId: string;
  projectId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  category: DocumentCategory;
  currentVersionId: string;
  createdBy: string;
  createdAt: Date;
  deletedAt?: Date;
}
```

### 18.2 DocumentVersion

```typescript
interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  storageKey: string;
  sha256: string;
  pageCount?: number;
  sheetNames?: string[];
  extractionStatus: string;
  uploadedBy: string;
  createdAt: Date;
}
```

### 18.3 Evidence

```typescript
interface Evidence {
  id: string;
  companyId: string;
  projectId: string;
  documentVersionId: string;
  evidenceType: EvidenceType;
  pageNumber?: number;
  sheetName?: string;
  cellRange?: string;
  sectionLabel?: string;
  boundingBox?: BoundingBox;
  originalContent: string;
  normalizedContent?: string;
  extractedValue?: string;
  normalizedValue?: number;
  extractedUnit?: string;
  normalizedUnit?: string;
  extractionMethod: string;
  confidence: number;
  sourceHash: string;
  createdAt: Date;
}
```

### 18.4 EntityLink

```typescript
interface EntityLink {
  id: string;
  companyId: string;
  projectId: string;
  entityType: "BUDGET_ITEM";
  entityId: string;
  entityVersion: string;
  evidenceId: string;
  relationType: RelationType;
  score: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  signals: Record<string, number | string | boolean>;
  methodVersion: string;
  validationStatus: "UNREVIEWED" | "CONFIRMED" | "REJECTED";
  validatedBy?: string;
  validatedAt?: Date;
  createdAt: Date;
}
```

### 18.5 ReviewRun

```typescript
interface ReviewRun {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  budgetVersion: string;
  status: ReviewRunStatus;
  configuration: ReviewConfiguration;
  ruleSetVersion: string;
  documentVersionIds: string[];
  progressPercent: number;
  warnings: ProcessingWarning[];
  requestedBy: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
```

### 18.6 Finding

```typescript
interface Finding {
  id: string;
  companyId: string;
  projectId: string;
  reviewRunId: string;
  budgetItemId: string;
  findingType: FindingType;
  status: FindingStatus;
  resolution?: FindingResolution;
  title: string;
  structuredComparison: Record<string, unknown>;
  evidenceIds: string[];
  entityLinkIds: string[];
  evidenceConfidence: number;
  linkConfidence: number;
  technicalSeverity: "HIGH" | "MEDIUM" | "LOW";
  priority: "HIGH" | "MEDIUM" | "LOW";
  priorityScore: number;
  potentialImpact?: number;
  currency?: string;
  ruleId: string;
  ruleVersion: string;
  explanation?: string;
  createdAt: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
}
```

### 18.7 FindingDecision y AuditEvent

Cada cambio de estado crea una decisión inmutable con valor anterior, nuevo valor, comentario, usuario, rol, timestamp y correlación. La auditoría no depende de logs de aplicación efímeros.

---

## 19. Contratos de servicio y API conceptual

Las rutas concretas deberán ajustarse a la arquitectura existente. Contratos sugeridos:

| Método | Ruta conceptual | Propósito |
|---|---|---|
| POST | `/projects/:projectId/documents` | Crear carga autorizada. |
| GET | `/projects/:projectId/documents` | Listar documentos y versiones. |
| PATCH | `/documents/:documentId/classification` | Corregir clasificación. |
| POST | `/budgets/:budgetId/review-runs` | Crear ejecución. |
| GET | `/review-runs/:id` | Estado, progreso y resumen. |
| POST | `/review-runs/:id/cancel` | Solicitar cancelación. |
| GET | `/review-runs/:id/findings` | Listar y filtrar hallazgos. |
| GET | `/findings/:id` | Obtener comparación y evidencia. |
| POST | `/findings/:id/decisions` | Registrar decisión explícita. |
| POST | `/entity-links/:id/validate` | Confirmar o rechazar vínculo. |
| GET | `/evidence/:id/view` | Recuperar vista autorizada de fuente. |

### Reglas de contratos

- Validar `companyId` desde la sesión, nunca desde confianza en el cliente.
- Usar idempotency key en cargas y ejecuciones.
- No devolver URLs permanentes de almacenamiento.
- Paginar hallazgos y documentos.
- Registrar correlación entre petición, job, revisión y eventos.
- Rechazar decisiones sobre hallazgos obsoletos sin reconfirmación.
- Usar control de concurrencia optimista para resoluciones.

---

## 20. Procesamiento asíncrono y resiliencia

### 20.1 Requisitos

- jobs reanudables por etapa;
- reintentos con backoff en fallos transitorios;
- idempotencia por documento, versión y configuración;
- límite de concurrencia por empresa;
- timeout por etapa;
- cancelación cooperativa;
- dead-letter o estado de fallo inspeccionable;
- progreso basado en etapas reales, no animación ficticia;
- reejecución parcial de páginas/hojas fallidas cuando sea seguro.

### 20.2 Fallo parcial

Si 5 de 200 páginas fallan, la revisión puede continuar como `COMPLETED_WITH_WARNINGS` si:

- se enumeran páginas fallidas;
- los hallazgos no afirman cobertura total;
- los hallazgos de “sin documentación” se desactivan para áreas afectadas;
- el usuario puede reprocesar.

### 20.3 Deduplicación

El hash del archivo y la configuración permiten detectar cargas o análisis idénticos. El sistema puede reutilizar extracción segura, pero crea un nuevo `ReviewRun` cuando el usuario solicita una revisión nueva para conservar historial.

---

## 21. Seguridad, privacidad y permisos

### 21.1 Aislamiento

- Todas las entidades incluyen `companyId`.
- Toda consulta se filtra en servidor por tenant.
- Archivos y derivados se almacenan con namespaces aislados.
- Los índices semánticos respetan el mismo límite de empresa/proyecto.
- Las pruebas deben cubrir intentos de acceso cruzado.

### 21.2 Roles iniciales

| Acción | Admin | Editor técnico | Revisor | Lector |
|---|---:|---:|---:|---:|
| Cargar/reemplazar documentos | Sí | Sí | Opcional | No |
| Iniciar revisión | Sí | Sí | Sí | No |
| Ver resultados | Sí | Sí | Sí | Sí |
| Resolver hallazgo | Sí | Sí | Sí | No |
| Editar presupuesto | Según permiso | Según permiso | No por defecto | No |
| Gestionar retención | Sí | No | No | No |

### 21.3 Controles de archivo

- lista permitida de MIME y extensiones;
- validación real del contenido;
- antivirus/malware scanning;
- rechazo de archivos corruptos o cifrados no soportados;
- no ejecución de macros, scripts, enlaces ni contenido activo;
- URLs temporales y autorizadas para visualización;
- cifrado en tránsito y reposo.

### 21.4 IA y proveedores

- Configurar por empresa qué proveedores pueden procesar documentos.
- Minimizar el contenido enviado a modelos externos.
- No usar datos del cliente para entrenamiento sin consentimiento explícito y separado.
- Registrar proveedor, modelo, región si aplica, versión y propósito.
- Permitir desactivar funciones generativas manteniendo comparaciones determinísticas cuando sea viable.

### 21.5 Retención y eliminación

La empresa deberá poder conocer y configurar la retención admitida por su plan. Eliminar un documento impide nuevo acceso al contenido y activa el proceso de eliminación de derivados, índices y cachés, conservando únicamente la auditoría mínima legal/técnica que corresponda y sin conservar el contenido original en ella.

---

## 22. Guardrails técnicos y de IA

1. `humanReviewRequired = true` en todos los hallazgos.
2. `automaticBudgetMutation = false` sin excepción en V0.
3. Los valores exactos se extraen de fuentes o del dominio MC; no se fabrican.
4. Toda explicación distingue dato, cálculo e inferencia.
5. Todo cálculo muestra inputs y fórmula recuperables.
6. Un resultado de baja confianza no se formula como hecho.
7. La ausencia de match no demuestra ausencia documental.
8. Prompts, modelos y reglas se versionan.
9. Contenido del documento se trata como datos no confiables; instrucciones embebidas no alteran el comportamiento del sistema.
10. Khipu usa herramientas con esquemas y permisos; no genera consultas arbitrarias ni acceso directo a almacenamiento.
11. Las salidas estructuradas se validan antes de persistir.
12. Fallos del modelo no bloquean la consulta de resultados determinísticos ya existentes.

---

## 23. Requisitos no funcionales

### 23.1 Rendimiento

- La navegación de resultados existentes debe responder en menos de 2 segundos en p95, excluyendo descarga del documento.
- Filtros de la bandeja: menos de 1 segundo en p95 para proyectos piloto.
- Abrir evidencia: inicio de render menor a 3 segundos en p95 bajo condiciones normales.
- El procesamiento puede tardar minutos; debe informar progreso y no bloquear la sesión.

### 23.2 Disponibilidad y recuperación

- Los resultados persistidos deben seguir disponibles si un proveedor de IA está temporalmente caído.
- Los jobs recuperables se reanudan desde checkpoints.
- Ningún reintento crea hallazgos duplicados.
- Se respaldan metadatos, decisiones y relaciones según la política general de MC.

### 23.3 Observabilidad

- logs estructurados sin texto sensible innecesario;
- métricas por etapa, formato y método de extracción;
- trazas con correlation ID;
- costo de OCR, embeddings y LLM por ejecución;
- alertas por tasa de fallos, latencia, cola y consumo anómalo;
- panel interno de calidad sin exponer datos entre empresas.

### 23.4 Escalabilidad

La arquitectura debe permitir workers independientes para extracción, OCR, matching y reglas. V0 puede usar infraestructura administrada, siempre que preserve idempotencia, límites por tenant y separación de responsabilidades.

---

## 24. Métricas de éxito

### 24.1 North Star del MVP

> Porcentaje de revisiones piloto en las que el usuario confirma al menos un hallazgo útil con evidencia correcta y reporta ahorro de tiempo.

### 24.2 Métricas de calidad

| Métrica | Definición | Meta piloto inicial |
|---|---|---:|
| Evidence coverage | Hallazgos publicados con evidencia accesible | 100% |
| Citation accuracy | Evidencias que abren en la fuente correcta | ≥ 98% |
| Finding precision | Hallazgos evaluados como útiles o problemas confirmados | ≥ 70% global |
| High-priority precision | Hallazgos de alta prioridad útiles/confirmados | ≥ 85% |
| False-positive rate | Hallazgos marcados falsos positivos | ≤ 20% global |
| Match precision alta | Vínculos de confianza alta confirmados | ≥ 90% |
| Processing success | Revisiones completadas o con advertencias utilizables | ≥ 95% |

Las metas son criterios de aprendizaje del piloto, no compromisos públicos. Se analizarán por tipo de hallazgo; un promedio no debe ocultar una regla deficiente.

### 24.3 Métricas de valor

- tiempo manual estimado vs. tiempo de revisión con MC;
- tiempo hasta el primer hallazgo resuelto;
- hallazgos revisados por sesión;
- porcentaje de ejecuciones que llegan a `REVIEWED`;
- usuarios que repiten una revisión en 30 días;
- proyectos por empresa que usan la función;
- intención de pago y conversión de design partners.

### 24.4 Métricas de costo

- costo por página;
- costo por revisión;
- costo por hallazgo útil;
- porcentaje de páginas que requieren OCR;
- tokens y llamadas por etapa;
- reutilización de extracción/caché.

---

## 25. Analítica de producto

Eventos mínimos:

```text
review_page_viewed
document_upload_started
document_upload_completed
document_upload_failed
document_classification_changed
review_run_created
review_run_started
review_run_completed
review_run_failed
review_run_cancelled
finding_list_filtered
finding_opened
evidence_opened
entity_link_confirmed
entity_link_rejected
finding_decision_recorded
budget_edit_started_from_finding
review_marked_reviewed
khipu_review_query_submitted
```

Cada evento debe evitar incluir fragmentos técnicos o nombres de archivo como propiedades analíticas por defecto. Usar IDs opacos, categorías, duración, estado y métricas agregadas.

---

## 26. Criterios de aceptación del MVP

### 26.1 Documentos

- El usuario autorizado puede cargar PDF y XLSX válidos.
- El sistema rechaza de manera explicable archivos no soportados.
- Cada reemplazo crea una versión nueva.
- El usuario puede corregir la clasificación propuesta.
- Los fallos parciales muestran páginas u hojas afectadas.

### 26.2 Ejecución

- Una revisión registra versiones exactas de presupuesto, documentos, configuración y reglas.
- El usuario puede salir y volver mientras se procesa.
- El progreso refleja etapas persistidas.
- Reintentar no duplica evidencias ni hallazgos.
- Cambios relevantes posteriores marcan la revisión como obsoleta.

### 26.3 Hallazgos

- Sólo se generan los cinco tipos aprobados.
- Cada hallazgo tiene al menos una evidencia accesible.
- Las comparaciones numéricas son determinísticas y reproducibles.
- El lenguaje usa “posible”, “potencial” o “para revisar” cuando corresponda.
- La prioridad se calcula con una versión identificable de reglas.
- El usuario puede filtrar y ordenar resultados.

### 26.4 Evidencia

- Abrir fuente conduce a la página u hoja correcta.
- Cuando existe ubicación precisa, se resalta.
- Se muestran texto original, valor normalizado y método de extracción.
- Nunca se muestra una ubicación más precisa que la realmente disponible.

### 26.5 Decisión humana

- Ninguna corrección se aplica automáticamente.
- Toda resolución registra usuario, timestamp y valor.
- Corregir abre un flujo explícito del editor.
- Las decisiones históricas no se sobrescriben.
- Hallazgos obsoletos requieren reconfirmación.

### 26.6 Seguridad

- Un usuario no puede consultar archivos, evidencias o hallazgos de otra empresa.
- Las URLs de archivos expiran y requieren autorización.
- No se ejecutan macros ni contenido activo.
- El sistema registra proveedor/modelo sin exponer secretos.

---

## 27. Estrategia de pruebas

### 27.1 Dataset dorado

Crear un conjunto inicial de 10 expedientes reales o anonimizados, representativos de:

- diferentes disciplinas;
- PDF digital y escaneado;
- tablas simples y complejas;
- distintas estructuras de códigos;
- metrados en PDF y Excel;
- casos con discrepancias confirmadas y casos correctos.

Ingenieros etiquetarán manualmente vínculos y hallazgos esperados. El dataset deberá versionarse y aislarse conforme a permisos.

### 27.2 Pruebas unitarias

- normalización de unidades;
- conversiones permitidas;
- tolerancias;
- diferencias y porcentajes;
- impacto potencial;
- scoring de prioridad;
- transiciones de estado;
- obsolescencia;
- deduplicación e idempotencia.

### 27.3 Pruebas de integración

- carga → extracción → evidencia;
- evidencia → vínculo → regla → hallazgo;
- fallo parcial y reintento;
- reemplazo de documento y revisión obsoleta;
- resolución y auditoría;
- permisos por empresa/proyecto.

### 27.4 Evaluación de IA

- clasificación de secciones;
- extracción de atributos;
- precisión de matching por nivel de confianza;
- fidelidad de citas;
- tasa de salida inválida;
- resistencia a instrucciones maliciosas dentro de documentos;
- consistencia entre modelos/versiones.

### 27.5 Pruebas con usuarios

Cada design partner realizará tareas observables:

1. cargar documentos;
2. corregir una clasificación;
3. interpretar el dashboard;
4. revisar un hallazgo;
5. abrir evidencia;
6. confirmar o descartar;
7. localizar un tipo de hallazgo con Khipu.

Medir finalización, tiempo, dudas, confianza percibida y utilidad.

---

## 28. Estrategia de lanzamiento

### Fase 0 — Fundaciones internas

- modelo de documentos y provenance;
- versionado;
- pipeline básico PDF/XLSX;
- visor de evidencia;
- reglas determinísticas aisladas;
- auditoría y permisos.

**Salida:** un equipo interno puede rastrear manualmente una evidencia hasta una partida.

### Fase 1 — Alpha técnica

- 2–3 expedientes controlados;
- diferencia de metrado;
- unidad inconsistente;
- vínculos revisados manualmente;
- métricas detalladas.

**Salida:** comparaciones reproducibles y citas correctas.

### Fase 2 — Alpha con design partners

- 5–10 profesionales;
- hasta 10 expedientes;
- cinco tipos de hallazgo;
- feedback estructurado;
- sesiones observadas.

**Salida:** precisión suficiente en hallazgos prioritarios y evidencia de ahorro de tiempo.

### Fase 3 — Beta privada

- controles de consumo;
- más diversidad documental;
- Khipu con tools de consulta;
- dashboard de costos y calidad;
- onboarding y soporte.

**Salida:** uso repetido y al menos algunos usuarios con disposición de pago.

### Fase 4 — Beta ampliada

- empaquetado comercial;
- límites por plan;
- SLA y políticas definidas;
- exportación de informe;
- mejora continua de precisión.

**No avanzar por calendario.** Cada fase requiere cumplir criterios de calidad, seguridad y uso.

---

## 29. Roadmap posterior al MVP

### V0.1

- CSV;
- exportación de resumen;
- asignación de hallazgos;
- comparación entre ejecuciones;
- mejoras de OCR y tablas.

### V1

- mejor cobertura de metrados, especificaciones y APU;
- reglas adicionales de recursos y rendimientos;
- comentarios y colaboración;
- integraciones controladas con importación/exportación existente;
- aprendizaje privado por empresa a partir de vínculos confirmados.

### V2

- interpretación limitada de planos PDF;
- referencias cruzadas entre planos, especificaciones y partidas;
- control de versiones documentales avanzado.

### V3

- IFC/BIM;
- entidades de modelo vinculadas con partidas y metrados;
- validaciones 5D específicas.

### V4

- revisión integral de expedientes de gran tamaño;
- reglas contractuales o normativas específicas con fuentes versionadas;
- flujos empresariales y aprobaciones avanzadas.

### V5

- generación asistida de borradores de partidas, metrados o APU;
- aplicación exclusivamente mediante revisión, aprobación y auditoría;
- conocimiento autorizado de empresa y conocimiento peruano curado.

---

## 30. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Falsos positivos erosionan confianza | Alto | Pocos tipos de hallazgo, umbrales conservadores, calibración por tipo y lenguaje prudente. |
| Matching incorrecto | Alto | Señales múltiples, confianza visible, confirmación humana y candidatos alternativos. |
| OCR/tablas deficientes | Alto | Detectar calidad, advertir, permitir reclasificar/reprocesar y excluir hallazgos de ausencia. |
| Costos de procesamiento elevados | Medio/alto | Routing, caché, extracción selectiva, límites y telemetría por etapa. |
| Documentos sensibles | Alto | Cifrado, tenant isolation, retención, permisos, auditoría y políticas de proveedor. |
| El MVP intenta cubrir demasiado | Alto | Mantener PDF/XLSX, cinco hallazgos y un presupuesto por ejecución. |
| Dependencia de un LLM | Medio/alto | Abstracción de proveedor, resultados estructurados, reglas propias y persistencia independiente. |
| Usuario confunde hallazgo con error certificado | Alto | Copy prudente, disclaimer contextual, estados humanos y evidencia visible. |
| Correcciones desincronizadas | Medio | Versionado, estado `STALE` y referencias a versiones de entidad. |
| Mezcla de conocimiento entre empresas | Crítico | Aislamiento estricto y prohibición de aprendizaje cruzado no autorizado. |

---

## 31. Dependencias

### Dependencias de producto

- modelo estable de presupuesto, partidas, metrados, APU y recursos;
- importación o existencia de presupuesto en MC;
- permisos multiusuario por empresa/proyecto;
- editor capaz de abrir una partida desde un hallazgo.

### Dependencias técnicas

- almacenamiento privado de objetos;
- base de datos con versionado y auditoría;
- cola y workers;
- extracción PDF y XLSX;
- OCR bajo demanda;
- índice de búsqueda/semántico con aislamiento por tenant;
- visor PDF y tabular;
- capa de proveedores IA;
- observabilidad y medición de costos.

### Dependencias operativas

- design partners con expedientes reales;
- protocolo de anonimización y consentimiento;
- participación de un ingeniero de costos en etiquetado y evaluación;
- soporte para investigar falsos positivos y fallos de extracción.

---

## 32. Decisiones de producto adoptadas

1. El nombre funcional inicial será **MC Revisión Inteligente**.
2. Vivirá dentro de MC Presupuestos.
3. MC Presupuestos será la fuente autoritativa del presupuesto.
4. PDF y XLSX serán los formatos del V0.
5. Habrá exactamente cinco familias iniciales de hallazgos.
6. Evidence será un concepto de primer nivel.
7. La cobertura de evidencia exigida para hallazgos publicados será 100%.
8. Khipu consultará herramientas y resultados persistidos; no tendrá acceso directo de escritura.
9. No habrá modificación automática del presupuesto.
10. El feedback humano será estructurado y auditable.
11. La revisión se ejecutará de forma asíncrona y versionada.
12. El conocimiento de empresa permanecerá aislado.
13. La primera validación se realizará con aproximadamente 10 expedientes variados.

---

## 33. Decisiones que deberán validarse durante el piloto

Estas decisiones no bloquean el desarrollo de las fundaciones, pero deberán resolverse con datos del piloto:

- umbrales exactos de confianza por tipo de vínculo;
- tolerancias predeterminadas por unidad o disciplina;
- pesos del priority score;
- proveedores y modelos con mejor relación precisión/costo;
- límites comerciales por páginas, archivos y ejecuciones;
- utilidad real del hallazgo “APU potencialmente incompleto”;
- necesidad de asignación y colaboración en la primera beta;
- formato de exportación preferido;
- disposición de pago: por usuario, proyecto, páginas o créditos.

Estas variables deben almacenarse como configuración versionada, no codificarse de manera irreversible.

---

## 34. Definition of Done del MVP

MC Revisión Inteligente V0 estará terminada cuando:

1. un usuario autorizado pueda cargar PDF/XLSX y asociarlos a un proyecto;
2. las fuentes se procesen con estado, advertencias, versión y trazabilidad;
3. el sistema pueda relacionar una parte significativa de partidas con evidencia en el dataset piloto;
4. se ejecuten los cinco tipos de hallazgo aprobados;
5. cada hallazgo publicado abra la fuente correcta;
6. diferencias, porcentajes e impactos sean reproducibles por código;
7. ninguna acción modifique automáticamente el presupuesto;
8. el usuario pueda confirmar, corregir, validar, descartar o pedir más información;
9. todas las decisiones queden auditadas;
10. la revisión detecte cambios posteriores y se marque obsoleta;
11. se cumplan las pruebas de aislamiento multiempresa;
12. los KPIs de calidad se midan por ejecución y tipo de hallazgo;
13. al menos 5–10 design partners completen revisiones de expedientes reales;
14. exista evidencia cualitativa y cuantitativa de ahorro de tiempo;
15. el equipo pueda decidir con datos si avanzar a beta privada.

---

## 35. Milestone verificable

> Un ingeniero carga un presupuesto real y documentos PDF/XLSX del proyecto. MC relaciona automáticamente una parte útil de las partidas con metrados o especificaciones, identifica posibles inconsistencias de cinco tipos y permite verificar y resolver cada hallazgo directamente contra su fuente, sin modificar datos técnicos automáticamente.

Si este milestone funciona de forma confiable con 10 expedientes diferentes, Mercado y Construcción habrá validado el primer bloque defendible de su capa de inteligencia: **Evidence → Relationships → Findings → Human Review → Knowledge Events**.

---

## 36. Referencias de producto

Este PRD se alinea con los siguientes documentos de estrategia proporcionados para el proyecto:

1. **Validación de mercado para Mercado y Construcción: plataforma de tecnología e IA para ingeniería y construcción en Perú y Latinoamérica.** Tesis utilizada: foco estrecho inicial; MC Costos + MC Revisor; interoperabilidad; trazabilidad; revisión humana; conocimiento estructurado y cálculos determinísticos.
2. **Plan de Implementación — Landing Page Mercado y Construcción.** Tesis utilizada: Mercado y Construcción como marca matriz; MC Presupuestos como producto de entrada; Khipu como IA integrada, especializada y supervisada; promesas públicas limitadas a capacidades reales.

---

## 37. Resumen para implementación posterior

El orden recomendado de construcción es:

```text
1. Domain model estable
2. Document + DocumentVersion
3. Evidence + provenance
4. Pipeline PDF/XLSX
5. Viewer de evidencia
6. EntityLink + matching
7. Deterministic Rule Engine
8. ReviewRun + Finding
9. Review Queue + resoluciones
10. Auditoría + Knowledge Events
11. Khipu tools
12. Piloto y calibración
```

Este orden evita construir primero una interfaz conversacional sin datos confiables debajo. La capacidad central del producto no será el prompt: será la combinación verificable de modelo técnico, fuentes, relaciones, reglas y decisiones humanas.
