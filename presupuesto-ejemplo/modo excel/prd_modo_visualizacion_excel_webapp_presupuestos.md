# PRD — Sistema de Visualización Global “Modo Excel”

## Proyecto

Web App de Presupuestos y Costos de Obra

## Feature

Sistema de visualización global:
- Vista Moderna
- Vista Tipo Excel

---

# 1. Resumen Ejecutivo

La aplicación actualmente utiliza una interfaz moderna visualmente atractiva, pero para usuarios técnicos que trabajan diariamente con grandes volúmenes de datos (APU, metrados, partidas, insumos, fórmulas polinómicas, programación de obra, etc.), se necesita una experiencia más compacta, eficiente y orientada a productividad.

Esta funcionalidad permitirá alternar entre:

| Modo | Objetivo |
|---|---|
| Moderna | Experiencia visual actual |
| Tipo Excel | Máxima densidad de información y rapidez operativa |

La nueva vista “Tipo Excel” transformará toda la interfaz relacionada con tablas y formularios en una experiencia similar a una hoja de cálculo profesional.

---

# 2. Objetivos del Producto

## Objetivos principales

- Mejorar productividad de usuarios técnicos
- Permitir visualizar más datos en pantalla
- Reducir scroll vertical
- Hacer edición masiva más eficiente
- Generar experiencia familiar para ingenieros y presupuestistas
- Mantener compatibilidad con interfaz moderna actual

---

# 3. Problema Actual

## Situación actual

La interfaz moderna:
- Tiene mucho padding
- Usa cards amplias
- Posee separación visual alta
- Reduce cantidad de datos visibles
- No es óptima para edición intensiva

## Problema para el usuario

Usuarios de costos y presupuestos:
- Trabajan como si estuvieran en Excel
- Necesitan velocidad
- Necesitan ver más filas simultáneamente
- Necesitan navegación rápida
- Prefieren layouts compactos

---

# 4. Solución Propuesta

Agregar un sistema global de visualización configurable por usuario.

El usuario podrá elegir:

## A. Vista Moderna
Mantiene el diseño actual.

## B. Vista Tipo Excel
Transforma visualmente:
- tablas
- inputs
- formularios
- grids
- celdas
- headers
- paneles

hacia un diseño compacto y técnico.

---

# 5. Alcance Funcional

---

# 5.1 Selector Global de Vista

## Nombre

“Modo de visualización”

## Opciones

| Valor | Label |
|---|---|
| modern | Moderna |
| excel | Tipo Excel |

## Ubicación

Debe mostrarse en:
- Header principal
- Toolbar del presupuesto
- O menú de configuración

---

# 5.2 Persistencia

La preferencia debe guardarse en:
- localStorage

## Clave sugerida

```js
app_view_mode
```

## Comportamiento esperado

| Acción | Resultado |
|---|---|
| Usuario cambia vista | UI cambia instantáneamente |
| Usuario recarga página | Vista se mantiene |
| Usuario abre otro módulo | Vista sigue activa |

---

# 5.3 Estado Global

Debe existir un estado global accesible desde toda la app.

## Nombre sugerido

```ts
viewMode
```

## Valores

```ts
type ViewMode = 'modern' | 'excel'
```

## Opciones recomendadas

- React Context
- Zustand
- Redux
- Sistema actual del proyecto

---

# 5.4 Clase Global de Aplicación

Cuando el usuario seleccione Excel:

```html
<body class="view-mode-excel">
```

o

```html
<div class="app view-mode-excel">
```

Cuando seleccione Moderna:

```html
<body class="view-mode-modern">
```

---

# 6. Diseño del Modo Excel

---

# 6.1 Características Visuales

## Debe incluir

- Diseño compacto
- Bordes visibles
- Menor spacing
- Inputs simples
- Estética tipo spreadsheet
- Alta densidad de información
- Filas compactas
- Headers simples
- Menos sombras
- Menos bordes redondeados

---

# 6.2 Tablas

## Requerimientos

### Bordes

Todas las celdas deben tener borde visible.

### Compactación

Reducir:
- padding
- height
- spacing

### Header

- Fondo gris claro
- Texto pequeño
- Peso semibold

### Hover

Hover sutil.

---

# 6.3 Inputs

## Características

- Border radius = 0 o mínimo
- Tamaño compacto
- Altura reducida
- Sin sombras modernas
- Similar a Excel

---

# 6.4 Cards / Panels

## Características

- Bordes simples
- Sin sombras fuertes
- Radius reducido
- Padding pequeño

---

# 6.5 Botones

## Características

- Compactos
- Rectangulares
- Padding reducido

---

# 7. Componentes Afectados

---

# 7.1 Módulos Principales

## Debe afectar

### Presupuestos
- Lista de partidas
- Resumen
- Subpresupuestos

### APU / ACU
- Recursos
- Rendimientos
- Costos

### Insumos
- Materiales
- Mano de obra
- Equipos

### Metrados

### Fórmula polinómica

### Programación de obra

### Reportes

### Análisis de costos

### Gastos generales

### Fórmulas y reajustes

---

# 7.2 Componentes UI

## Tablas

- DataTable
- EditableTable
- GridTable

## Formularios

- Inputs
- Selects
- Textareas
- Numeric fields

## Navegación

- Toolbars
- Filters
- Search bars

---

# 8. Arquitectura Técnica

---

# 8.1 Estado Global

## Recomendación

Crear:

```ts
ViewModeProvider
```

y hook:

```ts
useViewMode()
```

---

# 8.2 Hook esperado

```ts
const {
  viewMode,
  setViewMode,
  isExcelMode
} = useViewMode()
```

---

# 8.3 Persistencia

## Al iniciar

Leer:

```js
localStorage.getItem('app_view_mode')
```

## Al cambiar

Guardar:

```js
localStorage.setItem('app_view_mode', mode)
```

---

# 8.4 CSS Strategy

## Recomendación

Usar:
- clases globales
- CSS variables
- Tailwind variants
- o data attributes

---

# 8.5 Estructura sugerida

```html
<div data-view-mode="excel">
```

o

```html
<body class="view-mode-excel">
```

---

# 9. UX Requirements

---

# 9.1 Cambio Instantáneo

El cambio entre modos:
- NO debe recargar página
- Debe ser inmediato

---

# 9.2 Consistencia

Toda la app debe responder al mismo modo.

---

# 9.3 Compatibilidad

El modo Excel:
- NO cambia lógica
- NO afecta cálculos
- NO modifica exportaciones
- NO altera backend

---

# 10. Diseño Visual Esperado

---

# 10.1 Vista Moderna

## Mantiene

- Cards modernas
- Espaciado amplio
- Bordes redondeados
- Sombras suaves

---

# 10.2 Vista Excel

## Apariencia

Inspirada en:
- Excel
- Google Sheets
- SAP grids
- Sistemas ERP técnicos

---

# 11. Requerimientos No Funcionales

---

# Performance

- El cambio debe ser instantáneo
- No debe generar rerenders masivos innecesarios

---

# Escalabilidad

Debe permitir agregar futuras vistas:
- Compact
- Dark spreadsheet
- Minimal
- Dense ERP

---

# Mantenibilidad

Evitar estilos duplicados por componente.

---

# 12. Casos de Uso

---

# Caso 1 — Presupuestista técnico

## Flujo

1. Abre presupuesto
2. Activa “Tipo Excel”
3. Visualiza más partidas
4. Edita rápidamente

## Resultado esperado

Mayor productividad.

---

# Caso 2 — Usuario gerencial

## Flujo

1. Usa vista moderna
2. Navega dashboards
3. Presenta reportes

## Resultado esperado

Experiencia visual atractiva.

---

# 13. Criterios de Aceptación

---

# Funcionales

✅ Usuario puede cambiar entre vistas  
✅ Preferencia persiste  
✅ Cambio es instantáneo  
✅ Todas las tablas responden  
✅ Inputs cambian visualmente  
✅ Layout compacto funciona  
✅ Vista moderna sigue intacta

---

# Visuales

✅ Bordes visibles en tablas  
✅ Menor padding  
✅ Inputs compactos  
✅ Headers tipo spreadsheet  
✅ Diseño técnico consistente

---

# Técnicos

✅ Sin errores de render  
✅ Sin afectar cálculos  
✅ Sin romper responsive  
✅ Compatible con tablas editables

---

# 14. Roadmap Futuro

---

# Fase futura posible

## Spreadsheet Advanced Mode

- Navegación con teclado
- Copiar/pegar celdas
- Multi-cell editing
- Fórmulas inline
- Freeze columns
- Column resizing
- Keyboard shortcuts
- Virtual scrolling

---

# 15. Prioridad

## Prioridad

ALTA

## Impacto

MUY ALTO

## Complejidad

MEDIA

---

# 16. Resultado Esperado Final

La aplicación debe poder transformarse completamente entre:

## Experiencia moderna SaaS

y

## Experiencia técnica tipo Excel profesional

sin afectar la lógica de negocio ni la arquitectura existente.

