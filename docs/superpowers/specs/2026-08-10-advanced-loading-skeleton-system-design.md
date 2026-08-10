# Sistema Avanzado De Esqueletos De Carga - Especificacion

## Objetivo

Crear un sistema global, consistente y funcional de esqueletos de carga para MC Presupuestos. El sistema debe eliminar dobles skeletons, reemplazar cargas genericas por placeholders que reflejen el layout real, y establecer una politica clara para cargas de pagina, seccion, tabla, formulario, grafico y accion puntual.

El resultado debe sentirse como una aplicacion SaaS tecnica moderna: estable durante la navegacion, precisa en las superficies financieras, compacta donde haya tablas, y sin spinners centrales cuando el usuario necesita entender que estructura esta esperando.

## Contexto Actual

El proyecto ya cuenta con varias piezas de carga, pero estan dispersas:

- `components/ui/app-skeleton.tsx` define `AppSkeletonBlock` como primitive basico.
- Muchas rutas tienen `app/**/loading.tsx` que renderizan `<AppShell>` y contenido skeleton.
- `components/layout/app-shell.tsx` es un Server Component async que carga sesion, workspace, settings, licencia y cookies.
- `components/layout/app-shell-loading-frame.tsx` existe, pero actualmente solo envuelve `children` sin representar shell.
- `app/dashboard/page.tsx` usa `Suspense` interno con skeletons locales.
- `components/dashboard/dashboard-analytics-section-skeleton.tsx` y `components/dashboard/khipu-quality-metrics-skeleton.tsx` usan estilos propios.
- Modulos como cronograma, settings, admin, AI, presupuesto, partidas y recursos usan estados internos con `Loader2`, textos de carga o skeletons locales.

Problemas observados:

- Algunos `loading.tsx` vuelven a renderizar `AppShell`, lo que puede duplicar o encadenar estados de carga con el shell real.
- Hay skeletons demasiado genericos para paginas con tablas financieras complejas.
- Existen estilos de skeleton mezclados: `AppSkeletonBlock`, `animate-pulse` directo, spinners y textos.
- Algunas cargas internas reemplazan paneles completos por texto, aunque el layout final es tabla, grafico o formulario.
- No existe una taxonomia de estados de carga por nivel: pagina, seccion, widget, accion.

## Principios De Producto

- El skeleton debe parecerse al contenido real que reemplaza.
- La navegacion debe mantener el shell visualmente estable.
- Las tablas deben cargar como tablas: encabezados, columnas y filas aproximadas.
- Los formularios deben cargar como formularios: labels, inputs y acciones.
- Los graficos deben cargar como superficies de grafico, no como spinner central.
- Los botones pueden usar spinner solo para acciones puntuales.
- Los refetches sobre contenido existente no deben borrar toda la vista.
- La UI de APU y subpartidas debe preservar columnas, densidad, altura de fila, bordes y decimales del contexto padre.
- No introducir dependencias nuevas para skeletons.
- No cambiar formulas financieras, calculos, APIs ni persistencia.

## Taxonomia De Carga

### Carga De Shell

Representa sidebar, header global, workspace switcher, tema, vista global y boton principal. Debe ser estable y no depender de datos especificos de la pagina.

Uso:

- Navegacion inicial a rutas autenticadas.
- Fallback de layout si se introduce un layout agrupado para app autenticada.

No debe:

- Renderizar datos falsos de pagina.
- Ejecutar nuevamente la carga completa del `AppShell` real desde cada `loading.tsx`.

### Carga De Pagina

Representa el primer estado de una ruta. Debe reflejar la estructura principal de esa pagina.

Ejemplos:

- Dashboard: KPI cards, paneles analiticos, actividad.
- Presupuesto: toolbar, tabla de partidas, panel resumen.
- Recursos/partidas: filtros, tabla virtualizada, acciones.
- Settings: header local, tabs o secciones, formularios.

### Carga De Seccion

Representa una parte async dentro de una pagina ya visible. Debe mantener altura y contexto.

Ejemplos:

- Analytics del dashboard.
- Metricas de calidad de Khipu.
- Calendario valorizado, calendario de insumos y Curva S.
- Paneles de historial o preview.

### Carga De Tabla

Representa datos tabulares con columnas y densidad cercanas a la tabla real. Es obligatoria para presupuestos, recursos, partidas, metrados, formula polinomica, gastos generales, calendario valorizado y calendario de insumos.

Debe incluir:

- Header de tabla.
- Filas con anchos variados.
- Columnas numericas alineadas a la derecha.
- Columnas sticky simuladas cuando existan.
- Altura de fila compatible con vista moderna o Excel.

### Carga De Formulario

Representa labels, controles y acciones. No debe usar un spinner central salvo que el formulario sea muy pequeno y este dentro de un dialogo de accion puntual.

### Carga De Grafico

Representa tarjeta, titulo, area de plot, ejes o barras/lineas fantasma. Debe evitar spinner centrado.

### Carga De Accion

Representa acciones locales como guardar, exportar, probar conexion, generar, descargar o eliminar.

Permitido:

- `Loader2` dentro de botones.
- Texto corto de accion como `Guardando...` o `Exportando...`.

No permitido:

- Reemplazar toda la pagina por un skeleton durante una accion local.

## Arquitectura Propuesta

### Primitives Compartidos

Crear `components/ui/loading/` con primitives reutilizables:

- `skeleton-block.tsx`: bloque base con variante, radio, pulso y shimmer.
- `skeleton-text.tsx`: lineas de texto con ancho configurable.
- `skeleton-button.tsx`: boton fantasma con tamanos comunes.
- `skeleton-icon.tsx`: icono/avatar fantasma.
- `skeleton-card.tsx`: contenedor de card coherente con `components/ui/card`.
- `skeleton-table.tsx`: tabla fantasma configurable.
- `skeleton-toolbar.tsx`: filtros, busqueda y acciones.
- `skeleton-form.tsx`: secciones de formulario.
- `skeleton-chart.tsx`: grafico fantasma.
- `index.ts`: exports publicos.

Estas primitives reemplazan usos directos de `animate-pulse` y consolidan estilos.

### Layouts Compartidos

Crear `components/loading/` para composiciones por layout:

- `app-shell-skeleton.tsx`: shell visual no async.
- `page-skeleton-frame.tsx`: estructura comun para paginas dentro del shell.
- `dashboard-page-skeleton.tsx`
- `catalog-page-skeleton.tsx`
- `budget-editor-page-skeleton.tsx`
- `settings-page-skeleton.tsx`
- `work-schedule-page-skeleton.tsx`
- `ai-page-skeleton.tsx`

Los layouts deben usar primitives y exponer props minimas: `titleWidth`, `descriptionWidth`, `tableColumns`, `rowCount`, `showSidebarPanel`, `density`.

### Politica De Shell

Separar la responsabilidad visual del shell de la carga de datos:

- `AppShell` sigue siendo el shell real async.
- `AppShellSkeleton` representa el shell durante la carga inicial.
- Los `loading.tsx` de paginas autenticadas deben usar una composicion estable: shell skeleton cuando el shell no esta listo, o solo skeleton de contenido cuando el layout ya provee shell.

La implementacion debe empezar sin reestructurar todo App Router. Primero se crea `AppShellSkeleton` y se migran `loading.tsx` existentes a una convencion uniforme. Si despues se detecta que un route group autenticado reduce duplicacion, se puede planificar como una fase separada.

### Contrato De Skeletons

Todo skeleton compuesto debe cumplir:

- No recibe ni calcula datos financieros reales.
- No usa `any`.
- Usa clases Tailwind y variables existentes de tema.
- Usa `aria-hidden="true"` para bloques decorativos.
- Si la region reemplaza contenido importante, el contenedor externo usa `aria-busy="true"` y `aria-label` descriptivo.
- Mantiene dimensiones estables para reducir CLS.
- No anida cards decorativas dentro de cards, salvo items repetidos reales.

## Alcance Por Fases

### Fase 1: Fundacion

- Crear primitives de loading.
- Crear `AppShellSkeleton`.
- Crear `PageSkeletonFrame`.
- Migrar `AppSkeletonBlock` para delegar en la nueva primitive sin romper imports existentes.
- Agregar tests unitarios de clases, accesibilidad basica y render.

### Fase 2: Rutas Principales

Migrar:

- `app/dashboard/loading.tsx`
- `app/projects/loading.tsx`
- `app/projects/[id]/loading.tsx`
- `app/budgets/loading.tsx`
- `app/budgets/[id]/loading.tsx`
- `app/resources/loading.tsx`
- `app/partidas/loading.tsx`
- `app/templates/loading.tsx`
- `app/settings/loading.tsx`
- `app/account/loading.tsx`
- `app/metrados-avanzados/loading.tsx`

Cada ruta debe usar un skeleton especifico o configurable que refleje su layout.

### Fase 3: Fallbacks Internos

Migrar skeletons y cargas internas:

- `components/dashboard/dashboard-analytics-section-skeleton.tsx`
- `components/dashboard/khipu-quality-metrics-skeleton.tsx`
- `components/budget/work-schedule/derived-views.tsx`
- `components/budget/work-schedule-page-content.tsx`
- `components/budget/general-budget-overview.tsx`
- `components/ai/khipu-quality-metrics-panel.tsx`
- `components/settings/work-calendars-settings.tsx`
- `components/settings/khipu-agent-settings-card.tsx`
- `components/admin/admin-cloud-ai-settings.tsx`

Objetivo: spinners centrales solo en acciones pequenas; skeletons semanticos para paneles de datos.

### Fase 4: Politica Anti-Doble Skeleton

Crear una prueba o verificacion estatica para evitar patrones peligrosos:

- `app/**/loading.tsx` no debe crear dos niveles visuales incompatibles.
- Fallbacks de `Suspense` dentro de una pagina no deben duplicar una seccion ya cubierta por el skeleton de pagina.
- Refetches no deben reemplazar toda una pagina ya cargada.

Documentar excepciones permitidas.

### Fase 5: QA Visual

Validar las rutas principales en:

- Desktop.
- Mobile.
- Vista moderna.
- Vista Excel cuando aplique.
- Tema claro/oscuro si el tema actual lo soporta.

Si Playwright esta disponible, agregar pruebas visuales ligeras o smoke tests que confirmen que las rutas renderizan skeletons sin solapes.

## Criterios De Aceptacion

- Existe un sistema centralizado en `components/ui/loading`.
- `AppSkeletonBlock` sigue funcionando para compatibilidad, pero usa la nueva base.
- Las rutas principales usan skeletons que reflejan su layout final.
- Dashboard, presupuestos, catalogos, settings y metrados no usan skeletons genericos de cards cuando cargan tablas o formularios.
- Los fallbacks internos del dashboard y cronograma usan skeletons semanticos.
- No hay spinners centrales para cargas de tablas, graficos o formularios de pantalla completa.
- Las acciones locales mantienen spinners en botones cuando corresponde.
- No se modifican calculos financieros ni APIs.
- `npm run test` pasa para pruebas afectadas.
- `npm run lint` pasa.
- El plan identifica una estrategia explicita para eliminar dobles skeletons.

## Riesgos Y Mitigaciones

### Riesgo: Reestructurar Demasiado El App Router

Mitigacion: empezar con componentes skeleton compartidos y migracion incremental. No mover rutas ni layouts hasta tener evidencia de que reduce duplicacion sin romper datos del shell.

### Riesgo: Skeletons Visualmente Bonitos Pero Inexactos

Mitigacion: cada skeleton de dominio debe basarse en el layout real de su pagina: columnas, paneles, toolbars y densidad.

### Riesgo: Duplicar Componentes De UI

Mitigacion: las primitives viven en `components/ui/loading`; las composiciones de pagina viven en `components/loading`.

### Riesgo: Romper Accesibilidad

Mitigacion: bloques decorativos con `aria-hidden`; regiones con `aria-busy`; botones con spinners conservan labels accesibles.

### Riesgo: Cambios Visuales En Modulos Financieros Criticos

Mitigacion: no tocar calculos ni datos. Verificar presupuesto, APU, gastos generales y formula polinomica con tests existentes.

## Fuera De Alcance Inicial

- Cambiar arquitectura de datos.
- Cambiar APIs.
- Crear una libreria externa de skeletons.
- Agregar animaciones complejas o dependencias.
- Redisenar el shell real.
- Implementar streaming granular de datos mas alla de los `Suspense` existentes.
- Visual regression pixel-perfect obligatoria para todas las paginas.

## Orden Recomendado

1. Fundacion de primitives y `AppShellSkeleton`.
2. Migracion de `loading.tsx` principales.
3. Migracion de fallbacks internos de dashboard y cronograma.
4. Auditoria anti-doble skeleton.
5. QA visual y documentacion.
