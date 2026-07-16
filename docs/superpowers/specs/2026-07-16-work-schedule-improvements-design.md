# Mejoras Del Cronograma De Obra - Especificacion

## Objetivo

Convertir el cronograma de obra de MC Presupuestos en una herramienta completa de control y seguimiento, no solo de planificacion. La mejora debe permitir comparar lo programado, la linea base y el avance real; detectar desviaciones; recalcular impactos por dependencias; advertir sobre sobreasignacion de recursos; respetar calendario laboral peruano; y generar entregables formales para supervision, contratistas y entidades publicas.

El enfoque debe ser incremental. Primero se cerrara el flujo de avance real, porque el modelo ya tiene `actualStartDate`, `actualEndDate` y `percentComplete`. Luego se ampliara Curva S, reprogramacion, calendario laboral, recursos, WBS y PDF.

## Contexto Actual

El cronograma ya cuenta con una base avanzada:

- Vista general con tabla sincronizada y Gantt.
- Calendario valorizado.
- Calendario de insumos.
- Curva S programada.
- Edicion inline y editor lateral.
- Undo/Redo.
- Dependencias FS, SS, FF, SF con lag.
- Drag and drop de barras Gantt.
- Baseline visual.
- Generacion inteligente.
- CPM y ruta critica.
- Exportacion CSV/XLSX.
- API REST para guardar y generar.
- Preferencias de UI en `localStorage`.

Tambien existen piezas parciales para las mejoras:

- `types/work-schedule.ts` ya contiene campos reales en lineas de cronograma.
- `lib/validations/work-schedule.ts` ya valida `actualStartDate`, `actualEndDate` y `percentComplete`.
- `lib/data/work-schedule.ts` ya persiste campos reales.
- `components/budget/gantt/gantt-bar.tsx` y `components/budget/gantt/timeline-row.tsx` ya reconocen `percentComplete`.
- `recalculateDependentWorkScheduleLines` ya existe en `lib/calculations/work-schedule.ts`.
- `components/budget/work-schedule/utils/edit-helpers.ts` ya usa recalc en preview, pero no debe quedar solo ahi.

## Principios De Producto

- Mantener el lenguaje visual actual: SaaS tecnico, limpio, compacto y profesional.
- Evitar convertir el cronograma en un ERP pesado.
- Priorizar claridad de datos, lectura rapida y acciones reversibles.
- Mantener calculos fuera de UI.
- Todas las reglas de fechas, avance, curva y recursos deben ser testeables.
- No simplificar formulas financieras ni valorizaciones.
- No usar `any`.
- No introducir dependencias grandes salvo que una exportacion PDF lo justifique y sea aprobada.

## Alcance Por Fases

### Fase 1: Seguimiento De Avance Real

El usuario debe poder ver y editar avance real desde la vista general y el editor lateral.

Campos visibles:

- `% avance`
- `inicio real`
- `fin real`

Comportamiento:

- `percentComplete` debe mostrarse como porcentaje entre `0` y `100`.
- `actualStartDate` y `actualEndDate` se editan como fechas ISO.
- Si `percentComplete` es `100` y no hay `actualEndDate`, la UI puede sugerir completar `actualEndDate`, pero no debe hacerlo silenciosamente.
- Si hay `actualEndDate`, `percentComplete` debe poder seguir siendo editable para corregir errores.
- Si `actualStartDate` es posterior a `actualEndDate`, se debe mostrar error.
- Si una partida esta en ruta critica y tiene avance menor al programado esperado, debe resaltarse de forma sobria.

Visualizacion Gantt:

- Barra base: programado actual.
- Baseline: referencia congelada si existe.
- Progreso real: overlay dentro de la barra programada usando `percentComplete`.
- Tooltip o popover debe mostrar programado, baseline y real.

No incluye:

- Control diario de partes de obra.
- Evidencias fotograficas.
- Flujo de aprobacion de avance.

### Fase 2: Curva S Programada Vs Real

La vista Curva S debe mostrar al menos dos series:

- `Programado`
- `Real`

La serie real debe calcularse con avance ponderado por costo parcial de cada partida.

Regla conceptual:

```text
monto_real_partida = partial * percentComplete / 100
avance_real_acumulado = suma_acumulada(monto_real_partida_por_periodo) / monto_total
```

Cuando la partida no tiene distribuciones mensuales, el calculo debe usar el rango `startDate` a `endDate` como fallback, siguiendo patrones existentes.

Indicadores:

- Avance programado acumulado.
- Avance real acumulado.
- Desviacion en puntos porcentuales.
- Estado: adelantado, en linea, atrasado.

No incluye:

- Earned Value completo con costo real incurrido.
- CPI financiero real, porque todavia no existe captura de costo real.

### Fase 3: Reprogramacion Automatica Con Preview

Cuando el usuario cambia una tarea que tiene dependientes, el sistema debe calcular el impacto y mostrarlo antes de persistir.

Disparadores:

- Cambio de `startDate`.
- Cambio de `endDate`.
- Cambio de `durationDays`.
- Cambio de `predecessor`.
- Drag and drop de barra Gantt.

Preview:

- Lista de partidas afectadas.
- Fecha anterior y nueva fecha.
- Variacion en dias.
- Indicar si alguna partida afectada es critica.

Acciones:

- `Aplicar reprogramacion`: guarda la partida editada y dependientes recalculadas.
- `Guardar solo esta partida`: persiste solo la partida editada.
- `Cancelar`: descarta el cambio.

Regla:

- `recalculateDependentWorkScheduleLines` debe seguir siendo la fuente canonica del calculo.
- El preview no debe mutar el estado persistido.

### Fase 4: Calendario Laboral Peruano

El calendario laboral debe afectar calculo y visualizacion.

Incluye:

- Dias laborables segun `workCalendar`.
- Fines de semana no laborables.
- Feriados peruanos configurables.
- Sombreado de dias no laborables en Gantt.
- Leyenda compacta en timeline.

Comportamiento:

- Duracion debe calcularse con dias laborables cuando el modo de calendario este activo.
- Las funciones existentes de calendario deben ser reutilizadas.
- Los feriados deben poder mantenerse en configuracion del proyecto o presupuesto.

No incluye:

- Calendarios por cuadrilla.
- Calendarios por frente de obra.
- Sincronizacion automatica con fuentes externas de feriados.

### Fase 5: Nivelacion Y Alertas De Recursos

La primera version no debe mover fechas automaticamente. Debe detectar picos y sobreasignaciones.

Modelo:

- Cada recurso puede tener una capacidad maxima por periodo.
- La demanda por periodo sale del calendario de insumos.
- La sobreasignacion existe cuando `demand > capacity`.

UI:

- Histograma por recurso o familia.
- Modo cantidades y modo monto, respetando el calendario de insumos actual.
- Alertas por periodo.
- Filtro "solo sobreasignados".

No incluye:

- Optimizador automatico de fechas.
- Resolucion automatica de conflictos.

### Fase 6: WBS Jerarquico

El WBS debe mejorar lectura y orden, sin reemplazar codigos de partida.

Incluye:

- Codigo WBS visual tipo `1`, `1.2`, `1.2.3`.
- Indentacion jerarquica.
- Colapso por nivel.
- Exportacion de WBS en CSV/XLSX/PDF cuando aplique.

Regla:

- `itemCode` sigue siendo el codigo de partida.
- `wbsCode` es derivado o persistido segun arquitectura final.

### Fase 7: Exportacion PDF

El usuario debe poder exportar un paquete PDF profesional.

Incluye:

- Resumen ejecutivo.
- Gantt por rango.
- Calendario valorizado.
- Curva S programada vs real.
- Alertas principales.
- Datos de proyecto, presupuesto, moneda y fecha de emision.

Estilo:

- Formato limpio, tecnico y sobrio.
- Tablas compactas.
- Encabezados claros.
- Preparado para supervision y presentacion contractual.

## Funcionalidades Adicionales Recomendadas

### Panel De Desviaciones

Mostrar:

- Partidas atrasadas.
- Partidas adelantadas.
- Partidas sin avance real.
- Partidas criticas con avance insuficiente.
- Variacion contra baseline.

### Lookahead De Obra

Vista operativa para 2, 4 y 6 semanas:

- Partidas que deben iniciar.
- Partidas que deben terminar.
- Predecesoras pendientes.
- Recursos con riesgo de sobrecarga.

### Hitos Contractuales

Permitir marcar hitos obligatorios:

- Fecha contractual.
- Fecha programada.
- Estado.
- Desviacion.

### Versionado De Cronograma

Guardar snapshots antes de cambios importantes:

- Version actual.
- Version anterior.
- Motivo del cambio.
- Usuario y fecha.

### Indicadores SPI Basicos

Calcular indicadores simples:

- Avance real / avance programado.
- Desviacion porcentual.
- Semaforo por proyecto, subpresupuesto y frente.

### Control Por Frente De Obra

Cuando existan frentes:

- Avance por frente.
- Curva S por frente.
- Alertas por frente.
- Recursos sobreasignados por frente.

## Arquitectura Propuesta

### Calculos

Mantener reglas en `lib/calculations` o `lib/work-schedule`, no en componentes React.

Servicios sugeridos:

- `lib/work-schedule/progress.ts`: avance real y desviaciones.
- `lib/work-schedule/curve-s.ts`: series programada y real.
- `lib/work-schedule/rescheduling.ts`: preview de impacto.
- `lib/work-schedule/resource-capacity.ts`: sobreasignaciones.
- `lib/work-schedule/wbs.ts`: generacion de codigos WBS.
- `lib/work-schedule/pdf-export.ts`: payload o generacion PDF, si se decide servidor.

### UI

Mantener componentes dentro de:

- `components/budget/work-schedule`
- `components/budget/gantt`

Componentes sugeridos:

- `progress-fields.tsx`
- `reschedule-preview-dialog.tsx`
- `curve-s-comparison.tsx`
- `resource-capacity-panel.tsx`
- `schedule-deviation-panel.tsx`
- `lookahead-view.tsx`

### API

Extender APIs existentes solo cuando sea necesario:

- `PATCH /api/budgets/[id]/work-schedule`: guardar avance real y reprogramacion.
- `GET /api/budgets/[id]/work-schedule/curve-s`: incluir serie real.
- Nuevo endpoint opcional: `GET /api/budgets/[id]/work-schedule/deviations`.
- Nuevo endpoint opcional: `POST /api/budgets/[id]/work-schedule/export/pdf`.

## Criterios De Aceptacion

- El usuario edita y guarda `% avance`, `inicio real` y `fin real`.
- El Gantt muestra progreso real sobre barras existentes.
- La Curva S muestra programado y real.
- La reprogramacion muestra preview antes de afectar dependientes.
- El calendario respeta no laborables en calculo y visualizacion.
- El calendario de insumos detecta sobreasignaciones.
- El WBS se muestra sin alterar `itemCode`.
- El PDF exporta un paquete legible y profesional.
- Los calculos nuevos tienen tests unitarios.
- Las vistas principales mantienen tests de integracion donde aplique.
- `npm run lint` no introduce errores nuevos.

## Riesgos Y Mitigaciones

### Riesgo: Mezclar Avance Real Con Programacion

Mitigacion: mantener campos reales separados de fechas programadas. No modificar `startDate` o `endDate` automaticamente por avance real.

### Riesgo: Reprogramacion Sorprendente

Mitigacion: siempre mostrar preview y permitir guardar solo la partida editada.

### Riesgo: Curva S Real Incorrecta

Mitigacion: usar costo parcial como ponderador y cubrir casos con tests: sin avance, avance parcial, avance completo, sin distribuciones.

### Riesgo: PDF Pesado O Fragil

Mitigacion: empezar con paquete ejecutivo simple y datos tabulares antes de intentar renderizar un Gantt completo pixel-perfect.

### Riesgo: Sobrecarga De UI

Mitigacion: usar paneles compactos, filtros y vistas progresivas. No mostrar todas las alertas a la vez.

## Fuera De Alcance Inicial

- Control diario de produccion.
- Partes de obra con evidencias.
- Costos reales incurridos.
- CPI financiero real.
- Nivelacion automatica con optimizacion.
- Integracion MS Project XML.
- Monte Carlo de fechas.
- Flujos de aprobacion multiusuario.

## Orden Recomendado

1. Avance real completo.
2. Curva S real.
3. Reprogramacion automatica con preview.
4. Calendario laboral peruano.
5. Alertas de recursos.
6. WBS jerarquico.
7. PDF ejecutivo.
8. Panel de desviaciones, lookahead, hitos y versionado.
