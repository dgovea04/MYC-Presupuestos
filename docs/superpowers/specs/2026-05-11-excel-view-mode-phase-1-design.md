# Modo Excel Phase 1 Design

## Resumen

Esta especificación define la Fase 1 del sistema de visualización "Modo Excel" para la web app de presupuestos. La entrega se enfoca únicamente en el flujo de trabajo de presupuesto y APU, con selector local dentro de ese flujo, persistencia de preferencia por usuario en `localStorage`, y mejoras de productividad reales además del cambio visual.

La lógica de negocio, cálculos monetarios, exportaciones y backend no cambian. Esta fase solo modifica la experiencia de visualización y edición.

## Objetivo

Permitir que usuarios técnicos alternen entre una vista moderna y una vista tipo Excel dentro del flujo `presupuesto/APU`, obteniendo mayor densidad de información, navegación más rápida y una experiencia más cercana a una hoja de cálculo profesional sin alterar la arquitectura funcional del sistema.

## Alcance

### Incluye

- Selector de modo de visualización dentro del flujo de presupuesto/APU
- Persistencia de preferencia en `localStorage` con clave `app_view_mode`
- Estado compartido entre editor de presupuesto y editor APU
- Adaptación visual del `BudgetEditor`
- Adaptación visual del `ApuEditorSheet`
- Encabezados fijos en tablas principales
- Columnas más rígidas en tablas clave
- Mejoras de teclado enfocadas en productividad
- Estrategia reutilizable para llevar el modo a otros módulos en fases posteriores

### No incluye

- Selector global en el `header` principal de toda la app
- Modo Excel para `resources`, `general-expenses`, `polynomial-formula` o `overview` general
- Cambios en cálculos, validaciones o persistencia backend
- Virtualización pesada
- Freeze columns
- Edición multicelda avanzada
- Fórmulas inline
- Redimensionamiento manual de columnas

## Usuarios objetivo

### Usuario técnico de presupuestos

Necesita ver más filas simultáneamente, editar rápido, navegar con teclado y trabajar con una interfaz parecida a Excel o a sistemas ERP técnicos.

### Usuario gerencial

No es el foco de esta fase. Mantendrá la vista moderna dentro del mismo flujo si no activa el modo Excel.

## Decisiones de producto

1. La Fase 1 se limitará al flujo `presupuesto/APU` para maximizar impacto con riesgo controlado.
2. El selector vivirá localmente dentro de ese flujo y no en el `AppShell`.
3. La preferencia persistida se aplicará automáticamente al reingresar a pantallas relacionadas del mismo flujo.
4. La primera entrega incluirá mejoras de productividad reales, no solo compactación visual.
5. La arquitectura se preparará para mover este modo a un scope global en una Fase 2 sin rehacer componentes.

## Arquitectura

### ViewModeProvider local al flujo

Se creará un provider cliente para el flujo de presupuesto/APU con estado:

```ts
type ViewMode = "modern" | "excel";
```

La API pública esperada será:

```ts
type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isExcelMode: boolean;
};
```

Este provider envolverá la experiencia donde hoy se renderizan `BudgetEditor` y las superficies del flujo asociadas.

### Persistencia

- Lectura inicial desde `localStorage.getItem("app_view_mode")`
- Escritura inmediata al cambiar el modo
- Fallback a `modern` si el valor no existe o es inválido
- El cambio debe ser instantáneo y sin recarga

### Scope técnico

El estado no se sube todavía a `AppShell`. El provider quedará ubicado cerca del flujo de presupuesto para evitar impacto innecesario sobre módulos fuera de alcance.

### Señal visual compartida

El provider expondrá un contenedor raíz con `data-view-mode="modern"` o `data-view-mode="excel"`. Esa señal será la base para que componentes específicos y componentes UI reutilizables cambien su presentación sin duplicar lógica.

## Estrategia visual

### Modo Modern

Conserva el look actual:

- radios amplios
- sombras suaves
- spacing generoso
- cards con presencia visual
- controles de tamaño mediano

### Modo Excel

Adopta una estética compacta y técnica:

- celdas con bordes visibles
- padding reducido
- headers tipo spreadsheet
- menor radio
- menor sombra
- inputs rectangulares o casi rectangulares
- botones compactos
- mayor densidad de filas
- columnas con ancho más estable

### Principio de implementación

La visualidad no debe resolverse con duplicación completa de componentes. Debe apoyarse en una capa reusable de variantes de densidad, bordes, radio, sombras y estados de foco para que Fase 2 pueda extender la misma base.

## Componentes afectados en Fase 1

### Flujo de presupuesto

- `components/budget/budget-editor.tsx`
- `components/apu/apu-editor-sheet.tsx`

### Componentes UI base a adaptar

- `components/ui/table.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`

No todos requieren un rediseño profundo, pero sí necesitarán soportar variantes o clases adicionales que respondan al modo activo.

## Diseño funcional

### Selector de modo

El selector se ubicará dentro de la toolbar del presupuesto/APU. Debe mostrar:

- `Moderna`
- `Tipo Excel`

Comportamiento:

1. El usuario cambia el modo.
2. La UI cambia inmediatamente.
3. La preferencia queda persistida.
4. Al abrir luego el editor APU o regresar al presupuesto, el mismo modo se mantiene.

### BudgetEditor

En modo Excel:

- la tabla principal gana encabezado fijo
- se refuerza el uso de `colgroup` o anchos controlados
- se compactan paddings y alturas
- se disminuye protagonismo visual de paneles secundarios
- se refuerza visualmente fila activa y columna activa
- la lectura jerárquica de títulos, subtítulos y partidas se mantiene, pero con menos espacio desperdiciado

La funcionalidad existente de autosave, importación desde Excel, navegación de filas, APU y acciones sobre partidas debe seguir funcionando sin cambios de negocio.

### ApuEditorSheet

En modo Excel:

- la cabecera del panel lateral se vuelve más sobria
- métricas de rendimiento y costo se muestran en paneles compactos
- la tabla de recursos usa densidad alta
- las columnas numéricas mantienen alineación tabular rígida
- la edición de insumos prioriza continuidad de teclado y lectura comparativa

### Comportamientos de productividad

La Fase 1 incorporará:

- `sticky header` en tablas principales de presupuesto y APU
- mayor predictibilidad del foco entre celdas editables
- atajos adicionales de teclado sobre el editor actual
- anchos de columna estables en campos críticos

Atajos a incorporar o reforzar:

- `Ctrl/Cmd + S` para guardar manualmente
- `Alt + ↑ / ↓` para mover la fila activa
- `↑ ↓ ← → Enter Tab` para navegación entre celdas editables
- `Ctrl/Cmd + Enter` para abrir el APU de la partida activa
- `Escape` para cerrar el APU o cerrar overlays secundarios activos

Estos atajos deben convivir con el comportamiento ya existente del editor y no reemplazar accesos nativos del navegador fuera del flujo editable.

## Data flow

1. La pantalla del presupuesto monta el provider.
2. El provider lee `app_view_mode` desde `localStorage`.
3. El provider expone `viewMode`, `setViewMode` e `isExcelMode`.
4. `BudgetEditor` y `ApuEditorSheet` consumen ese estado.
5. Los componentes visuales aplican variantes según `data-view-mode` y props derivadas.
6. La lógica de cálculos sigue aislada en `lib/calculations` y no depende del modo visual.

## Error handling

### Persistencia

Si `localStorage` falla o no está disponible, el flujo debe seguir funcionando con modo `modern` por defecto, sin bloquear render.

### Hidratación

Como el modo depende de cliente, debe evitarse un flash visual disruptivo. Es aceptable iniciar en `modern` y ajustar al hidratar, siempre que el cambio sea breve y no rompa interacción.

### Compatibilidad

Si una tabla o control aún no soporta completamente el modo Excel, debe mantener un render funcional en estilo moderno antes que quedar inconsistente o inutilizable.

## Performance

- El cambio de modo debe sentirse instantáneo.
- No debe recalcular presupuestos ni APUs por cambiar presentación.
- Deben minimizarse rerenders masivos causados por props de estilo innecesarias.
- La preferencia debe resolverse una sola vez por carga y actualizar solo cuando el usuario cambie de modo.

## Testing

### Unitario

Se deben agregar pruebas para:

- lectura y escritura segura del modo en persistencia
- fallback a `modern` cuando el valor persistido es inválido
- helpers puros relacionados con view mode si se extraen

### Integración/UI

Se deben cubrir:

- cambio entre `modern` y `excel`
- persistencia del selector entre montajes
- aplicación del mismo modo en `BudgetEditor` y `ApuEditorSheet`
- presencia de clases, atributos o variantes esperadas para el modo Excel

### Regresión funcional

Validar que siguen operando:

- autosave
- navegación actual del editor
- apertura y cierre del APU
- edición de cantidades y precios
- importación/pegado ya existente

### Manual

Escenarios mínimos:

1. Activar modo Excel en presupuesto y recargar
2. Abrir APU y confirmar que respeta el mismo modo
3. Editar una partida y verificar que autosave y foco siguen operativos
4. Navegar con teclado entre celdas
5. Confirmar que modo Modern sigue intacto

## Responsive

Desktop es la prioridad principal de Fase 1. En pantallas pequeñas:

- la UI debe seguir siendo funcional
- no se busca reproducir una experiencia de spreadsheet completa
- puede mantenerse scroll horizontal controlado en tablas

## Riesgos

### Riesgo 1: estilos demasiado acoplados por componente

Mitigación:

- introducir una capa de variantes reusable
- evitar ramas visuales aisladas solo dentro de `BudgetEditor`

### Riesgo 2: conflictos entre foco, sticky headers y navegación

Mitigación:

- centralizar reglas visuales de celda activa
- probar navegación de teclado después de compactar inputs y celdas

### Riesgo 3: crecimiento desordenado hacia Fase 2

Mitigación:

- mantener la API del provider genérica
- basar estilos en `data-view-mode`
- no hardcodear el modo solo para un componente

## Criterios de aceptación de Fase 1

### Funcionales

- el usuario puede alternar entre `Moderna` y `Tipo Excel` dentro del flujo presupuesto/APU
- la preferencia persiste entre sesiones locales
- el editor de presupuesto y el editor APU responden al mismo modo
- el cambio no recarga la página

### Visuales

- tablas principales muestran headers fijos
- celdas y filas en modo Excel son más compactas
- inputs, selects, botones y cards del flujo se ven más técnicos y rectangulares
- las columnas críticas mantienen una estructura más rígida

### Técnicos

- no se afectan cálculos ni exportaciones
- no se rompe la edición actual
- la vista moderna sigue disponible y consistente
- la arquitectura queda lista para elevar el scope a nivel global en una fase posterior

## Plan para Fase 2

Una vez validada esta base:

1. mover el provider a un scope más alto
2. llevar el selector al `header` principal
3. extender la señal de modo a otros módulos técnicos
4. sumar capacidades avanzadas como freeze columns, edición multicelda y shortcuts más profundos

## Resultado esperado

El flujo de presupuesto/APU podrá alternar entre una experiencia moderna y una experiencia técnica tipo Excel, con mayor densidad, mejor continuidad operativa y persistencia de preferencia, sin tocar la lógica financiera ni los cálculos de presupuestos de obra.
