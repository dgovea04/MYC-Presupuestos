# Plan de implementación: mejora integral de la vista IA Khipu

**Fecha:** 2026-08-29
**Estado:** Implementación funcional completada; quedan E2E autenticado y validaciones visuales manuales
**Área:** `components/ai/`, `components/khipu/`, `docs/superpowers/`

## 1. Objetivo

Evolucionar la vista IA Khipu hacia un workspace más claro, enfocado y accionable para profesionales de presupuestos de obra. La experiencia debe ayudar al usuario a entender rápidamente:

1. qué contexto está activo;
2. qué puede hacer Khipu;
3. cuál es la acción recomendada;
4. qué proveedor/modelo ejecutará la solicitud;
5. cómo revisar y utilizar el resultado.

El plan prioriza claridad, reducción de densidad visual, consistencia de copy, seguridad de las acciones y trazabilidad de las respuestas.

## 2. Principios de implementación

- Mantener la arquitectura actual y reutilizar componentes existentes.
- Mantener la lógica de cálculo y preparación de datos fuera de la UI.
- No mutar presupuestos automáticamente desde una respuesta de IA.
- Requerir revisión humana antes de aplicar resultados.
- Usar matemáticas decimal-safe en cualquier cálculo financiero.
- Mantener TypeScript estricto y no utilizar `any`.
- Preferir Server Components; usar Client Components solo para interacción.
- Mantener compatibilidad responsive y navegación por teclado.
- Evitar introducir dependencias nuevas sin verificar que sean necesarias.

## 3. Estado actual observado

La vista ya cuenta con:

- encabezado de Khipu;
- contexto de trabajo;
- selección de proveedor;
- información de modelos y disponibilidad;
- acciones principales;
- formulario de ejecución;
- resultados estructurados;
- feedback;
- historial;
- acciones rápidas.

Las principales oportunidades son:

- demasiadas tarjetas compitiendo por atención;
- duplicación entre proveedor activo, proveedor y preparación;
- poca diferenciación entre configuración técnica y flujo de trabajo;
- ausencia de una acción recomendada explícita por contexto;
- estados vacíos y de carga mejorables;
- copy técnico o inconsistente;
- resultados que pueden ganar claridad y trazabilidad.

## 4. Fases de implementación

## Fase 0 — Preparación y línea base

### Tareas

- [ ] Revisar la composición actual de `AIWorkspace`, `AiAssistantPanel`, `ContextSidebar` y `KhipuQuickActions`.
- [ ] Identificar duplicaciones de copy y estados.
- [ ] Crear una matriz de estados de la vista:
  - contexto completo;
  - contexto parcial;
  - sin contexto;
  - proveedor local disponible;
  - proveedor cloud no configurado;
  - solicitud en curso;
  - error;
  - resultado estructurado;
  - historial vacío;
  - historial con datos.
- [ ] Registrar capturas o snapshots de referencia para desktop, tablet y móvil.
- [ ] Confirmar los tests existentes y separar tests de presentación de tests de comportamiento.

### Criterios de aceptación

- Existe una referencia reproducible de los estados principales.
- Se conocen los componentes que deben modificarse y los que deben permanecer estables.
- No se cambia la lógica de ejecución de IA durante esta fase.

## Fase 1 — Jerarquía visual y layout

### Objetivo

Hacer que la vista comunique primero contexto y acción, dejando la configuración técnica en segundo plano.

### Tareas

- [ ] Mantener una estructura principal de dos zonas:
  - columna principal: contexto, acción y ejecución;
  - columna derecha: contexto editable, inicio rápido y configuración local contextual.
- [ ] Reducir tarjetas innecesarias y agrupar información relacionada.
- [ ] Diferenciar visualmente:
  - información del presupuesto;
  - acciones de Khipu;
  - configuración de proveedor;
  - diagnóstico local.
- [ ] Hacer que el formulario de ejecución sea el foco principal.
- [ ] Revisar el orden vertical para que el usuario no necesite atravesar diagnósticos técnicos antes de ejecutar una acción.
- [ ] Mantener `Trabajo activo` compacto y mostrar solo los datos relevantes.
- [ ] Mantener `Inicio rápido` en la columna derecha con botones de una sola columna.
- [x] Mantener `Preparación local` como sección independiente debajo de Inicio rápido.
- [x] Mostrar Preparación local únicamente con runtime local habilitado y en desarrollo.

### Criterios de aceptación

- La acción activa y su formulario son visualmente dominantes.
- Trabajo activo no compite con el formulario.
- Inicio rápido no genera grids comprimidos.
- La información de modelos locales no aparece en producción.
- En móvil las columnas se apilan sin pérdida de funcionalidad.

## Fase 2 — Contexto y estado inicial

### Objetivo

Permitir que el usuario entienda qué información está utilizando Khipu y qué falta para obtener una respuesta confiable.

### Tareas

- [x] Simplificar el estado vacío a un mensaje orientado a la acción:
  - “Selecciona una partida para comenzar”.
- [ ] Mostrar claramente si el contexto viene del presupuesto o fue introducido manualmente.
- [ ] Añadir una acción para limpiar o editar el contexto cuando corresponda.
- [ ] Mostrar valores largos con tooltip, expansión o detalle accesible.
- [ ] Definir niveles de contexto:
  - suficiente;
  - parcial;
  - insuficiente.
- [ ] Reemplazar advertencias genéricas por mensajes específicos según la información faltante.
- [x] Añadir una recomendación de acción basada en el contexto activo.

### Reglas de recomendación

| Contexto | Acción sugerida |
|---|---|
| Partida o APU seleccionado | Revisar APU |
| Presupuesto activo sin partida | Analizar presupuesto |
| Texto incompleto | Autocompletar |
| Sin contexto | Chat técnico o seleccionar partida |

### Criterios de aceptación

- El usuario sabe qué contexto está activo sin leer varios bloques.
- El estado vacío indica claramente cómo continuar.
- Una recomendación puede cambiar al cambiar el contexto.
- Los mensajes no prometen precisión cuando falta información.

## Fase 3 — Acciones principales e Inicio rápido

### Objetivo

Reducir la carga cognitiva y hacer que las acciones más frecuentes sean fáciles de descubrir.

### Tareas

- [ ] Mantener cuatro acciones principales con nombres consistentes:
  - Chat técnico;
  - Generar APU;
  - Revisar presupuesto;
  - Autocompletar.
- [ ] Mostrar una acción recomendada visualmente.
- [ ] Revisar el orden de las acciones según frecuencia y contexto.
- [x] Mantener Inicio rápido en una sola columna.
- [ ] Evaluar limitar inicialmente Inicio rápido a las tres acciones más relevantes.
- [ ] Permitir mostrar acciones adicionales sin hacer que dominen la primera pantalla.
- [ ] Añadir estados hover, focus, pressed y disabled consistentes.
- [x] Añadir `aria-label` cuando el contenido visual no sea suficiente.
- [ ] Mantener el contexto al cambiar de acción.
- [ ] Confirmar que cambiar de acción no envía formularios accidentalmente.

### Copy sugerido

- Analizar presupuesto — “Detecta partidas que requieren revisión.”
- Revisar APU — “Evalúa insumos, rendimientos y coherencia técnica.”
- Comparar alternativas — “Compara soluciones y escenarios de costo.”
- Optimizar costos — “Sugiere alternativas para reducir costos.”
- Generar reporte — “Resume observaciones para el equipo técnico.”
- Detectar inconsistencias — “Identifica posibles errores en cantidades y unidades.”

### Criterios de aceptación

- La acción recomendada se reconoce sin depender solo del color.
- Los botones tienen un tamaño táctil adecuado.
- El cambio de acción no borra inputs ni contexto.
- Las acciones rápidas son legibles en desktop y móvil.

## Fase 4 — Proveedores y modelos

### Objetivo

Convertir la configuración técnica en información entendible y accionable.

### Tareas

- [ ] Separar visualmente proveedores disponibles, configurados y no configurados.
- [ ] Explicar por qué un proveedor está deshabilitado.
- [ ] Añadir enlace a Configuración cuando falte una API key.
- [ ] Sustituir mensajes internos como “Fallback activo” por copy de usuario.
- [ ] Mostrar disponibilidad sin depender únicamente del color.
- [ ] Mostrar proveedor y modelo utilizados después de una ejecución.
- [ ] Preservar inputs al cambiar de proveedor.
- [ ] Añadir actualización manual de estado.
- [ ] Para modelos locales, mostrar un resumen como “3 de 4 modelos disponibles”.
- [ ] Añadir instrucción o acción para instalar un modelo pendiente en desarrollo local.
- [ ] Evitar mostrar detalles técnicos locales en producción.

### Copy sugerido

- “Proveedor listo para ejecutar esta acción.”
- “Este proveedor requiere configuración antes de utilizarlo.”
- “Khipu usará un modelo alternativo porque el modelo seleccionado no está disponible.”
- “Modelos locales disponibles: 3 de 4.”

### Criterios de aceptación

- El usuario entiende por qué puede o no elegir un proveedor.
- El proveedor seleccionado no se confunde con el diagnóstico de modelos.
- No se exponen secretos ni información de configuración sensible.
- Los cambios de proveedor no destruyen el trabajo escrito.

## Fase 5 — Formulario de ejecución

### Objetivo

Hacer que cada acción tenga un flujo de entrada claro, contextual y seguro.

### Tareas

- [ ] Mejorar placeholders y ejemplos por acción.
- [ ] Añadir consultas sugeridas usando el contexto actual.
- [ ] Mantener labels visibles y accesibles.
- [ ] Mostrar estado de carga con texto y animación sutil.
- [ ] Añadir `aria-live` para cambios de estado.
- [ ] Evaluar botón de cancelación para solicitudes largas.
- [ ] Mantener botón de reintento solo cuando exista una solicitud reintentable.
- [ ] Impedir doble envío durante una solicitud.
- [ ] Mostrar qué proveedor/modelo procesará la consulta antes del envío cuando sea relevante.

### Ejemplos

**Chat técnico**

> “¿El rendimiento de esta partida es coherente con el tipo de obra y la unidad m³?”

**Generar APU**

> “Genera una propuesta de APU para concreto f’c=210 kg/cm² en m³.”

**Revisar presupuesto**

> “Revisa unidades, duplicados, rendimientos y costos atípicos.”

**Autocompletar**

> “Completa la descripción técnica sin inventar especificaciones.”

### Criterios de aceptación

- Cada acción tiene un placeholder específico.
- La carga es perceptible y no bloquea innecesariamente la navegación.
- No existe doble ejecución accidental.
- Las consultas sugeridas no mutan datos automáticamente.

## Fase 6 — Resultados y datos estructurados

### Objetivo

Presentar respuestas técnicas de forma comprensible, verificable y lista para revisión humana.

### Tareas

- [x] Separar visualmente:
  - resumen;
  - detalle técnico;
  - advertencias;
  - datos estructurados;
  - acciones posteriores.
- [x] Mostrar primero un resumen ejecutivo.
- [ ] Usar tablas reutilizables para resultados APU.
- [x] Mantener columnas consistentes para recurso, unidad y cantidad en los resultados disponibles; los precios se mantienen fuera cuando no son confiables.
- [ ] Aplicar el formato decimal configurado por el proyecto.
- [ ] Mantener precisión financiera con `decimal.js` u otra utilidad ya presente.
- [x] Resaltar campos que requieren revisión.
- [x] Mostrar proveedor, modelo y latencia de la respuesta.
- [x] Mostrar evidencia u origen cuando exista recuperación de información.
- [x] Permitir copiar resultados mediante el control existente de respuesta.
- [x] Añadir exportación independiente de propuestas IA a JSON y CSV, sin modificar el presupuesto oficial.
- [x] Mantener “revisión técnica requerida” antes de cualquier aplicación.
- [x] Mantener la confirmación explícita en las acciones aplicables antes de modificar el presupuesto.

### Criterios de aceptación

- El usuario puede entender la conclusión sin leer todo el detalle.
- Los datos estructurados conservan unidades y precisión.
- Los warnings son visibles y accionables.
- No se puede modificar un presupuesto sin confirmación humana explícita.
- Los resultados son testeables independientemente de la UI.

## Fase 7 — Historial, feedback y trazabilidad

### Objetivo

Convertir el historial en una herramienta de revisión y aprendizaje operativo.

### Tareas

- [ ] Mantener historial colapsado inicialmente si no es el foco de la sesión.
- [ ] Diferenciar historial local de historial del proyecto.
- [x] Mostrar fecha, acción, proveedor y estado.
- [x] Añadir búsqueda y filtros cuando aumente el volumen.
- [x] Mostrar estados de feedback:
  - aplicada;
  - editada;
  - descartada.
- [ ] Permitir reabrir una respuesta completa.
- [ ] Evaluar fijar o guardar resultados relevantes.
- [ ] Mejorar el texto de limpieza y confirmación.
- [ ] Mantener las respuestas de Bridge limitadas al alcance permitido.

### Criterios de aceptación

- El usuario sabe dónde se guardó una respuesta.
- El historial no se confunde con memoria permanente del proyecto.
- Las acciones de limpieza requieren confirmación.
- El feedback queda asociado a la entrada correcta.

## Fase 8 — Copy y consistencia terminológica

### Tareas

- [x] Revisar tildes en toda la vista:
  - Preparación;
  - Ejecución;
  - Acción;
  - Técnico;
  - Sesión;
  - Última latencia;
  - Configuración;
  - Análisis.
- [ ] Adoptar copy corto, directo y orientado a la acción.
- [ ] Mantener el encabezado: “Presupuesta mejor con Khipu.”
- [ ] Cambiar términos técnicos poco claros:
  - “Modelo resuelto” → “Modelo utilizado”;
  - “Fallback activo” → “Se utilizó un modelo alternativo”;
  - “Preparación local” → “Modelos locales”, si el contenido continúa limitado al diagnóstico de modelos.
- [ ] Uniformizar “presupuesto”, “partida”, “APU”, “recurso” e “insumo”.
- [ ] Evitar mensajes internos de implementación.
- [ ] Revisar consistencia entre botones, títulos, labels y mensajes de error.

### Criterios de aceptación

- No quedan textos sin tildes en la vista pública.
- Los términos técnicos tienen una explicación o un nombre comprensible.
- El copy no exagera las capacidades de Khipu.

## Fase 9 — Accesibilidad y responsive

### Tareas

- [ ] Validar contraste de textos secundarios.
- [ ] Validar foco visible en botones, inputs, selects y tabs.
- [x] Confirmar navegación completa con teclado en los componentes interactivos cubiertos por tests.
- [x] Añadir `aria-live` para carga, errores y resultados.
- [x] Asegurar que los estados no dependan solo del color.
- [ ] Revisar tamaños táctiles en móvil.
- [ ] Probar breakpoints de 320, 375, 768, 1024, 1280 y ultrawide.
- [x] Validar que la columna derecha no se vuelva demasiado estrecha mediante layout responsive y ancho mínimo de tablas.
- [ ] Evaluar acordeones para contexto y preparación en móvil.
- [ ] Revisar orientación horizontal móvil.

### Criterios de aceptación

- El flujo principal funciona solo con teclado.
- Todos los controles interactivos tienen nombre accesible.
- La vista permanece usable sin scroll horizontal.
- Los mensajes importantes son anunciados a tecnologías asistivas.

## Fase 10 — Testing y observabilidad

### Tests unitarios

- [ ] Testear las reglas de recomendación de acción por contexto.
- [ ] Testear el formateo de proveedor, modelo y latencia.
- [ ] Testear la visibilidad de Preparación local por runtime y entorno.
- [ ] Testear la normalización de estados de proveedor.
- [ ] Testear formatos de resultados estructurados.

### Tests de componentes

- [ ] Render inicial con contexto completo.
- [ ] Render sin contexto.
- [ ] Render con contexto parcial.
- [ ] Cambio de acción sin envío.
- [ ] Cambio de proveedor preservando inputs.
- [ ] Inicio rápido en una sola columna.
- [ ] Preparación local visible solo en local + desarrollo.
- [ ] Historial colapsado y expandido.
- [ ] Estado de carga, error y reintento.
- [ ] Resultado con warnings y feedback.

### Tests E2E

- [ ] Seleccionar presupuesto y ejecutar Chat técnico.
- [ ] Generar y revisar un APU.
- [ ] Revisar un presupuesto con contexto.
- [ ] Cambiar proveedor y completar una solicitud.
- [ ] Confirmar que no se muta el presupuesto automáticamente.
- [ ] Revisar historial y feedback.
- [x] Añadir smoke E2E opt-in para navegación de Khipu, tabs y responsive básico; requiere `E2E_KHIPU_PATH`.

### Criterios de aceptación

- `npm run typecheck` pasa.
- `npm run lint` pasa.
- Tests unitarios y de componentes pasan.
- Los tests E2E cubren el camino principal y las acciones destructivas o sensibles.
- No se registran secretos, prompts completos sensibles ni datos de presupuesto innecesarios.

## 5. Orden recomendado de entrega

### Entrega 1 — Claridad inmediata

- [ ] Layout de dos columnas.
- [ ] Trabajo activo compacto.
- [ ] Inicio rápido en columna única.
- [ ] Preparación local aislada y condicionada.
- [ ] Copy principal y tildes.
- [ ] Estado vacío mejorado.

### Entrega 2 — Acción contextual

- [ ] Acción recomendada por contexto.
- [ ] Placeholders y consultas sugeridas.
- [ ] Estados de proveedor más claros.
- [ ] Preservación de inputs al cambiar de proveedor.

### Entrega 3 — Resultados profesionales

- [x] Resumen ejecutivo.
- [x] Tablas APU reutilizables.
- [x] Warnings accionables.
- [x] Metadatos de ejecución incluidos en la exportación independiente; evidencia externa queda pendiente hasta que el contrato llegue en la respuesta.
- [ ] Confirmación antes de aplicar.

### Entrega 4 — Historial y calidad

- [ ] Historial mejorado.
- [ ] Feedback trazable.
- [x] Filtros y búsqueda.
- [x] Métricas de calidad visibles en el workspace de Khipu.

### Entrega 5 — Robustez

- [ ] Accesibilidad completa; quedan validaciones manuales de contraste, tamaños táctiles y E2E autenticado.
- [ ] Responsive completo.
- [x] Tests unitarios y de componentes pasan; E2E de Khipu queda pendiente de entorno autenticado con datos semilla.
- [ ] Revisión de rendimiento y telemetría.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Exceso de información técnica | Separar configuración de flujo principal y ocultar diagnóstico local fuera de desarrollo. |
| Respuestas de IA aplicadas incorrectamente | Revisión humana y confirmación explícita antes de mutar presupuestos. |
| Pérdida de datos al cambiar proveedor | Tests y preservación explícita de inputs/contexto. |
| Resultados financieros imprecisos | Cálculos aislados y decimal-safe; no redondear prematuramente. |
| Copy inconsistente | Diccionario de términos y revisión centralizada. |
| Layout roto en tablet | Pruebas específicas de breakpoints intermedios. |
| Historial confundido con memoria del proyecto | Etiquetas claras de alcance y persistencia. |
| Diagnóstico local visible en producción | Condición de runtime local y `NODE_ENV === "development"`, cubierta por tests. |

## 7. Definición de terminado

> Alcance de esta implementación: los puntos 1 y 2 (E2E autenticado y validación visual manual) quedan pendientes por requerir un entorno externo con credenciales, datos semilla y revisión en navegador real.

La mejora se considera completa cuando:

- [ ] El usuario entiende el contexto activo en menos de unos segundos.
- [ ] Existe una acción recomendada clara.
- [ ] El formulario de ejecución es el foco principal.
- [ ] Inicio rápido no se muestra comprimido.
- [ ] Preparación local solo aparece en el entorno permitido.
- [ ] Los proveedores muestran estados comprensibles.
- [ ] Los resultados presentan resumen, detalle, warnings y metadatos.
- [ ] Ninguna respuesta modifica el presupuesto sin revisión y confirmación.
- [ ] La vista funciona en desktop, tablet y móvil.
- [ ] La experiencia es navegable por teclado.
- [x] Typecheck, lint y tests relevantes pasan.

## 8. Comandos de validación

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

Para cambios específicos de Khipu, ejecutar también los tests focalizados de `components/ai/` y validar manualmente el flujo principal en desarrollo local.
