# PRD — Sistema de Análisis de Riesgos con Simulación Monte Carlo
## MYC Presupuestos

## 1. Visión General

El objetivo es implementar un módulo avanzado de análisis de riesgos para presupuestos de construcción utilizando simulaciones Monte Carlo, inspirado en herramientas como:

- @RISK
- Oracle Crystal Ball
- XL Risk

El sistema permitirá evaluar incertidumbre en:

- Costos
- Metrados
- Precios unitarios
- Duración
- Riesgo total del presupuesto

---

# 2. Fases del Proyecto

## FASE 1
### Riesgo por desviación de metrados

Simular incertidumbre en cantidades/metrados.

## FASE 2
### Riesgo por desviación de precios

Simular volatilidad de materiales, mano de obra y equipos.

---

# 3. Objetivos

Permitir al usuario:

- Definir variables inciertas
- Asignar distribuciones probabilísticas
- Ejecutar miles de simulaciones
- Obtener distribuciones de costos
- Analizar percentiles de riesgo
- Evaluar sensibilidad
- Calcular contingencias
- Generar curvas S e histogramas

---

# 4. Arquitectura General

```txt
Presupuesto
    ↓
Variables de Riesgo
    ↓
Distribuciones Probabilísticas
    ↓
Motor Monte Carlo
    ↓
Resultados Simulados
    ↓
Análisis Estadístico
    ↓
Dashboard de Riesgos
```

---

# 5. Entidades

## BudgetItem

```ts
type BudgetItem = {
  id: string
  code: string
  description: string
  quantity: number
  unitPrice: number
}
```

## RiskVariable

```ts
type RiskVariable = {
  id: string

  budgetItemId: string

  variableType:
    | 'quantity'
    | 'unit_price'

  distributionType:
    | 'triangular'
    | 'normal'
    | 'uniform'
    | 'pert'

  minimum: number
  mostLikely: number
  maximum: number

  stdDeviation?: number

  enabled: boolean
}
```

---

# 6. Distribuciones Iniciales

## Triangular (prioridad MVP)

Parámetros:
- mínimo
- probable
- máximo

## PERT

Más suave y realista.

## Normal

Distribución estadística tradicional.

## Uniforme

Escenarios simples.

---

# 7. UI del Módulo

Nueva pestaña:

```txt
Presupuesto
APU
Programación
Riesgos Monte Carlo
```

---

# 8. Tabla Principal

| Partida | Tipo | Distribución | Min | Probable | Max |
|---|---|---|---|---|---|

---

# 9. Simulación Monte Carlo

## Configuración inicial

```ts
iterations = 10000
```

## Algoritmo General

```txt
FOR iteration 1 → 10000

    FOR each risk variable

        Generate random value
        using selected distribution

        Recalculate item cost

    NEXT

    Sum total project cost

    Store simulation result

NEXT
```

---

# 10. Resultado de Simulación

```ts
type SimulationResult = {
  iteration: number

  totalCost: number

  itemResults: {
    itemId: string
    quantity: number
    unitPrice: number
    total: number
  }[]
}
```

---

# 11. Estadísticas Requeridas

| Métrica | Descripción |
|---|---|
| Mean | Promedio |
| Median | Mediana |
| Std Deviation | Desviación estándar |
| Variance | Varianza |
| Kurtosis | Curtosis |
| Skewness | Asimetría |
| P10 | Percentil 10 |
| P50 | Percentil 50 |
| P80 | Percentil 80 |
| P90 | Percentil 90 |
| P95 | Percentil 95 |

---

# 12. Dashboard

## Componentes

- Histograma
- Curva S
- Box Plot
- Tabla de percentiles
- KPI cards
- Tornado chart

---

# 13. Tecnologías Recomendadas

## Frontend

- Next.js
- TypeScript
- Zustand
- TanStack Table
- Recharts

## Librerías estadísticas

```bash
npm install probability-distributions
```

Alternativas:

```bash
npm install jstat
```

```bash
npm install simple-statistics
```

---

# 14. Performance

## Requisitos

- 10,000 iteraciones < 3 segundos

## Estrategia

- Web Workers
- Separar motor de simulación del UI

---

# 15. Componentes

```txt
components/risk/

├── RiskVariablesTable.tsx
├── RiskVariableModal.tsx
├── MonteCarloToolbar.tsx
├── SimulationProgress.tsx
├── HistogramChart.tsx
├── SCurveChart.tsx
├── PercentilesTable.tsx
├── TornadoChart.tsx
├── RiskKPICards.tsx
```

---

# 16. FASE 2 — Riesgo por Precios

Simular:

- Materiales
- Mano de obra
- Equipos

## Fórmula conceptual

```txt
Costo Total = Σ(Cantidad × Precio)
```

---

# 17. Roadmap

## MVP

- Riesgo por metrados
- Distribución triangular
- Histogramas
- Percentiles
- P50/P80/P90

## V2

- Riesgo por precios
- Curva S
- Tornado chart
- Export PDF

## V3

- Correlaciones
- Cronograma
- IA predictiva

---

# 18. Prompt Maestro para Codex

```txt
Implement a Monte Carlo Risk Analysis module for MYC Presupuestos.

The module must simulate uncertainty in construction budgets inspired by @Risk / XL Risk.

PHASE 1:
- quantity deviation risk only
- triangular distribution
- 10,000 iterations
- histogram
- cumulative S-curve
- percentiles P10/P50/P80/P90/P95
- variance
- standard deviation
- kurtosis
- Excel-style UI

TECH STACK:
- Next.js
- TypeScript
- Zustand
- Recharts
- TanStack Table

ARCHITECTURE:
- reusable components
- simulation engine separated from UI
- web worker for heavy calculations
- clean modular structure

CREATE:
- risk variable modal
- simulation dashboard
- histogram charts
- percentile tables
- KPI cards
- Monte Carlo engine

INSPIRED BY:
- @Risk
- Primavera Risk
- Oracle Crystal Ball
- Excel risk simulation workflows
```
