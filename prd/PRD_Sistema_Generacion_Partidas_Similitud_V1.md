# PRD — Sistema de Generación de Partidas por Similitud (V1 Semimanual)

## Proyecto
MYC Presupuestos

## Módulo
Generación Semimanual de Partidas Basada en Similitud

## Objetivo

Construir un sistema capaz de generar nuevas partidas de presupuesto utilizando como base el catálogo existente de partidas e insumos del sistema.

El sistema NO utilizará inteligencia artificial en esta etapa.

La generación se realizará mediante:
- análisis de similitud
- reglas estadísticas
- ponderaciones
- agregación de datos históricos
- selección semimanual del usuario

El objetivo principal es acelerar la creación de nuevas partidas manteniendo consistencia técnica y reutilización del catálogo existente.

---

# Problema

Actualmente la generación de partidas es manual y repetitiva.

Muchos proyectos contienen partidas similares:
- concreto armado
- columnas
- vigas
- losas
- encofrados
- tarrajeos
- excavaciones

Las diferencias suelen estar en:
- resistencia
- dimensiones
- ubicación
- rendimiento
- unidad
- composición parcial

Esto genera:
- duplicidad
- errores humanos
- variaciones innecesarias
- pérdida de estandarización
- tiempos altos de elaboración

---

# Objetivo de la V1

La V1 debe:
- sugerir partidas similares
- sugerir insumos
- sugerir cantidades
- sugerir precios
- permitir revisión humana
- mantener trazabilidad

La decisión final SIEMPRE será del usuario.

El sistema NO debe:
- crear partidas automáticamente sin revisión
- inventar insumos
- inventar precios
- modificar catálogos automáticamente

---

# Concepto General

El sistema funciona como un motor de similitud.

## Flujo resumido

1. Usuario escribe una nueva partida.
2. El sistema identifica variables clave.
3. Busca partidas similares.
4. Calcula similitud ponderada.
5. Sugiere partidas candidatas.
6. Extrae insumos comunes.
7. Calcula cantidades sugeridas.
8. Obtiene precios desde catálogo.
9. Usuario revisa y edita.
10. Usuario confirma y guarda.

---

# Ejemplo

## Entrada

Concreto armado f'c=210 kg/cm2 para columnas

---

# Variables detectadas

| Variable | Valor |
|---|---|
| Material | Concreto armado |
| Resistencia | 210 kg/cm2 |
| Elemento | Columnas |
| Categoría | Concreto |
| Unidad | m3 |

---

# Partidas similares encontradas

| Partida | Similitud |
|---|---|
| Concreto armado f'c=210 en columnas | 96% |
| Concreto f'c=210 en placas | 84% |
| Concreto f'c=210 en vigas | 79% |
| Concreto f'c=175 en columnas | 74% |

---

# Objetivos Funcionales

## OF-01 — Búsqueda de partidas similares

El sistema debe buscar partidas similares utilizando:
- texto
- categoría
- unidad
- variables técnicas
- composición de insumos

---

## OF-02 — Extracción de variables clave

El sistema debe detectar automáticamente:
- material
- resistencia
- tipo de elemento
- unidad
- especialidad
- palabras clave

---

## OF-03 — Scoring de similitud

El sistema debe calcular un score ponderado.

### Ponderaciones iniciales

| Criterio | Peso |
|---|---|
| Elemento constructivo | 30% |
| Especificación técnica | 25% |
| Material principal | 20% |
| Unidad | 10% |
| Categoría | 10% |
| Texto general | 5% |

---

## OF-04 — Selección semimanual

El usuario debe poder:
- aceptar partidas sugeridas
- eliminar partidas
- agregar partidas manualmente
- seleccionar partida principal

---

## OF-05 — Extracción de insumos

El sistema debe analizar todas las partidas seleccionadas y obtener:
- insumos repetidos
- frecuencia
- cantidades
- unidades
- tipo de recurso

---

## OF-06 — Clasificación de confianza

### Reglas iniciales

| Frecuencia | Acción |
|---|---|
| >= 80% | incluir automático |
| 50%–79% | sugerir revisión |
| < 50% | opcional |

---

## OF-07 — Cálculo de cantidades sugeridas

Para cada insumo calcular:
- promedio
- mediana
- mínimo
- máximo
- desviación estándar

La cantidad recomendada será:
- mediana ponderada

---

## OF-08 — Asignación de precios

Los precios deben salir EXCLUSIVAMENTE del catálogo de insumos.

Reglas:
- no inventar precios
- no crear insumos automáticamente
- sugerir equivalencias si existe similitud

---

## OF-09 — Generación de partida editable

El resultado debe ser completamente editable.

---

## OF-10 — Trazabilidad

Guardar:
- partidas fuente
- scores
- cantidades calculadas
- overrides del usuario
- fecha de generación

---

# Arquitectura del Sistema

# Componentes principales

## 1. Variable Extraction Service

Responsabilidad:
- detectar variables técnicas

---

## 2. Similarity Engine

Responsabilidad:
- buscar partidas similares

Métodos:
- coincidencia textual
- coincidencia estructurada
- coincidencia por catálogo

---

## 3. Candidate Selector

Responsabilidad:
- manejar partidas seleccionadas por usuario

Funciones:
- add
- remove
- primary reference

---

## 4. Insumo Aggregation Service

Responsabilidad:
- combinar insumos
- calcular frecuencias
- agrupar equivalencias

---

## 5. Quantity Suggestion Engine

Responsabilidad:
- calcular cantidades sugeridas

Métodos:
- mediana
- promedio ponderado
- desviación

---

## 6. Price Matching Service

Responsabilidad:
- buscar precios en catálogo

---

## 7. Review UI

Responsabilidad:
- permitir edición final

---

# Fórmula Inicial de Similitud

```txt
score_final =
  similitud_elemento * 0.30 +
  similitud_tecnica * 0.25 +
  similitud_material * 0.20 +
  similitud_unidad * 0.10 +
  similitud_categoria * 0.10 +
  similitud_texto * 0.05
```

---

# Tecnologías Recomendadas

## Frontend
- Next.js
- TypeScript
- Tailwind

## Backend
- Node.js
- PostgreSQL

## Búsqueda
Primera versión:
- SQL LIKE
- trigram similarity
- full text search

---

# Estrategia V1

La V1 debe priorizar:
- transparencia
- control humano
- trazabilidad
- consistencia técnica

NO automatización completa.

---

# Posibles Mejoras Futuras

## V2
- embeddings
- IA local
- ranking ML

## V3
- aprendizaje por usuario
- recomendaciones adaptativas
- generación automática avanzada


---

# Flujo Detallado

# Paso 1 — Usuario ingresa partida

Input:

```txt
Concreto armado f'c=210 kg/cm2 para columnas
```

---

# Paso 2 — Extracción de variables

Sistema detecta:
- concreto
- armado
- fc210
- columnas

---

# Paso 3 — Búsqueda

Consulta catálogo:
- partidas similares
- familia similar
- misma unidad

---

# Paso 4 — Ranking

Ordenar por score.

---

# Paso 5 — Selección usuario

Usuario:
- confirma
- elimina
- agrega

---

# Paso 6 — Extracción de insumos

Combinar insumos de candidatas.

---

# Paso 7 — Cálculo estadístico

Para cada insumo:
- frecuencia
- cantidad sugerida

---

# Paso 8 — Matching de precios

Buscar:
- precio vigente
- equivalencia

---

# Paso 9 — Revisión final

Usuario modifica:
- cantidades
- precios
- insumos

---

# Paso 10 — Guardado

Guardar:
- partida final
- metadata


---

# Modelo de Datos Propuesto

# Tabla generated_partidas

| Campo | Tipo |
|---|---|
| id | uuid |
| source_text | text |
| generated_name | text |
| similarity_score | decimal |
| created_by | uuid |
| created_at | timestamp |

---

# Tabla generated_partida_sources

| Campo | Tipo |
|---|---|
| generated_partida_id | uuid |
| partida_source_id | uuid |
| score | decimal |
| is_primary | boolean |

---

# Tabla generated_partida_insumos

| Campo | Tipo |
|---|---|
| generated_partida_id | uuid |
| insumo_id | uuid |
| quantity | decimal |
| confidence | decimal |
| calculation_method | text |

---

# UI Requerida

# Pantalla 1 — Nueva generación

## Input
- descripción partida

## Botón
- Buscar similares

---

# Pantalla 2 — Partidas candidatas

## Tabla
- score
- partida
- categoría
- unidad

## Acciones
- seleccionar
- eliminar
- marcar principal

---

# Pantalla 3 — Insumos sugeridos

## Tabla
- insumo
- frecuencia
- cantidad sugerida
- confianza
- precio
- parcial

---

# Pantalla 4 — Revisión final

## Editable
- cantidades
- precios
- agregar/eliminar insumos

---

# Reglas Técnicas

## El sistema NO debe:
- usar IA
- usar LLM
- generar texto libre
- inventar insumos
- inventar unidades
- inventar precios
