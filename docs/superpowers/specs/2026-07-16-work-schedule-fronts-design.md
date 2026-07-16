# Generacion Inteligente Por Frentes De Obra - Especificacion

## Objetivo

Agregar una estrategia de generacion de cronograma inteligente orientada a obras con varios frentes, capaz de producir un plan mas realista que el modo secuencial o por niveles sin introducir todavia un motor corporativo complejo.

La nueva estrategia debe permitir que partidas independientes se ejecuten en paralelo por frente de obra, mientras respeta una secuencia tecnica minima dentro de cada frente. La mejora debe quedar preparada para evolucionar luego hacia un modo mas avanzado con capacidad de cuadrillas, restricciones de recursos, hitos y buffers.

## Alcance

La primera version agregara una estrategia nueva llamada internamente `by_front` y mostrada al usuario como `Por frentes de obra`.

Incluye:

- Nueva opcion de estrategia en la generacion inteligente.
- Clasificacion tecnica simple de partidas segun descripcion, codigo, unidad y jerarquia.
- Agrupacion por frente usando subpresupuesto y grupo de nivel superior cuando exista.
- Ordenamiento constructivo por fases tecnicas.
- Paralelismo entre frentes independientes.
- Encadenamiento `FS` dentro del mismo frente cuando una fase depende de otra.
- Highlights de resumen que expliquen que se detectaron frentes y secuencia constructiva.
- Tests unitarios y de UI/API para cubrir la estrategia nueva.

No incluye en esta version:

- Motor de nivelacion de recursos.
- Restricciones por disponibilidad diaria de cuadrillas.
- Calendarios separados por frente.
- Camino critico avanzado por multiples tipos de relacion.
- Dependencias manuales sugeridas por IA externa.
- Interfaz visual para editar reglas tecnicas.

## Problema Actual

Las estrategias existentes cubren tres casos:

- `sequential`: agenda todo en secuencia segura, pero demasiado conservadora.
- `by_level`: permite paralelismo por niveles, pero no entiende fases constructivas.
- `by_similarity`: agrupa partidas parecidas, util para repetitividad, pero no representa necesariamente una obra por frentes.

Para una obra real con varios frentes, el cronograma deberia poder hacer algo como:

- Frente A empieza preliminares y movimiento de tierras.
- Frente B puede arrancar preliminares sin esperar a todo el Frente A.
- Dentro del Frente A, concreto no deberia empezar antes de excavacion si pertenecen al mismo frente.
- Acabados no deberian ir antes de estructura.
- Instalaciones pueden convivir con acabados segun reglas simples y desfases.

## Nueva Estrategia

### Nombre

Tipo interno:

```ts
type WorkScheduleGenerationStrategy = "sequential" | "by_level" | "by_similarity" | "by_front";
```

Etiqueta UI:

```text
Por frentes de obra
```

### Regla General

`by_front` debe construir el cronograma en dos niveles:

1. Frente de obra: unidad de paralelismo.
2. Fase tecnica: secuencia constructiva dentro del frente.

Los frentes pueden ejecutarse en paralelo. Las fases dentro de cada frente se ordenan por prioridad tecnica y se encadenan con dependencias `FS` cuando corresponda.

## Modelo Conceptual

### Frente De Obra

Un frente representa un bloque de trabajo que puede avanzar con independencia parcial.

La clave de frente se construira usando:

- `subBudgetId`.
- Ancestro superior de `levelId`, si existe.
- Fallback por `subBudgetId` cuando no haya jerarquia suficiente.

Ejemplo:

```text
subBudgetId=obra-principal + topLevelId=pabellon-a -> obra-principal:pabellon-a
subBudgetId=obra-principal + topLevelId=pabellon-b -> obra-principal:pabellon-b
subBudgetId=exteriores + sin nivel -> exteriores:default
```

### Fase Tecnica

La fase se infiere de forma deterministica y testeable, sin servicios externos.

Tipos propuestos:

```ts
type WorkFrontPhase =
  | "preliminaries"
  | "earthwork"
  | "structure"
  | "masonry"
  | "installations"
  | "finishes"
  | "testing"
  | "other";
```

Orden base:

```text
preliminaries -> earthwork -> structure -> masonry -> installations -> finishes -> testing -> other
```

`other` debe conservar el orden original relativo para no inventar una dependencia tecnica falsa cuando la clasificacion sea incierta.

### Clasificacion Por Palabras Clave

La clasificacion debe normalizar texto a minusculas y remover acentos antes de evaluar.

Reglas iniciales:

- `preliminaries`: preliminar, limpieza, trazo, replanteo, cartel, movilizacion, campamento, seguridad.
- `earthwork`: excavacion, corte, relleno, eliminacion, movimiento de tierras, nivelacion, compactacion.
- `structure`: concreto, hormigon, acero, fierro, encofrado, desencofrado, columna, viga, losa, zapata, cimentacion.
- `masonry`: muro, ladrillo, albañileria, tabique, asentado, tarrajeo primario si aparece ligado a muro.
- `installations`: electrica, sanitario, sanitaria, tuberia, desague, agua, cable, conduit, tablero, instalacion.
- `finishes`: pintura, ceramico, porcelanato, enchape, piso, acabado, cielo raso, carpinteria, puerta, ventana.
- `testing`: prueba, ensayo, puesta en marcha, limpieza final, entrega, recepcion.

Cuando varias reglas coincidan, gana la fase con menor orden tecnico, excepto `testing`, que debe ganar si aparece explicitamente como prueba o entrega.

## Dependencias

### Dentro Del Mismo Frente

La estrategia debe encadenar partidas generadas en orden tecnico usando `FS`.

Ejemplo esperado:

```text
1 Limpieza                 predecessor=null
2 Excavacion               predecessor=1FS
3 Concreto de zapata       predecessor=2FS
4 Muro de ladrillo         predecessor=3FS
5 Instalacion sanitaria    predecessor=4FS
6 Pintura                  predecessor=5FS
```

### Entre Frentes Diferentes

Por defecto no se crean predecesoras entre frentes distintos. Esto permite paralelismo real.

Ejemplo:

```text
Frente A - Limpieza        start=2026-08-01 predecessor=null
Frente B - Limpieza        start=2026-08-01 predecessor=null
```

### Subpresupuestos

Debe seguir respetando `interSubBudgetParallelism`:

- `parallel`: todos los subpresupuestos pueden arrancar en la misma fecha base.
- `staggered`: cada subpresupuesto aplica el desfase configurado.
- `independent`: mantiene la interpretacion actual del generador, sin forzar cadena global.

### Level Linkage

`levelLinkage` se debe respetar cuando venga configurado:

- `chain`: los grupos top-level dentro del mismo subpresupuesto se encadenan.
- `parallel`: los grupos top-level pueden empezar juntos.

Si `by_front` usa un top-level como frente y `levelLinkage` indica `chain`, la regla de enlace de nivel prevalece sobre el paralelismo natural.

## Calculo De Fechas

El calculo debe reutilizar los helpers existentes:

- `addWorkDays`
- `calculateWorkScheduleDurationDays`
- `buildWorkScheduleMonthlyDistributionsFromRange`
- `addDaysInclusive`
- `tryGenerateLine`

No se debe introducir logica duplicada de calendario. Las fechas deben respetar `workDaysBitmask` y `exceptionMap` igual que las estrategias actuales.

## Resumen E Highlights

`buildGenerationHighlights` debe reconocer `by_front`.

Highlights propuestos:

- `Estrategia por frentes de obra`
- `Frentes paralelos detectados`
- `Secuencia constructiva aplicada por fase tecnica`

Si no es simple calcular cantidad de frentes sin cambiar el contrato del summary, se debe omitir el numero en la primera version. La prioridad es que el texto sea cierto.

## UX

En el selector de estrategia debe aparecer:

```text
Por frentes de obra
```

Orden recomendado:

1. Secuencial
2. Por niveles
3. Por frentes de obra
4. Por similitud

La opcion por defecto puede seguir siendo `by_level` cuando existan grupos. No se cambiara el default global en esta primera version para reducir riesgo. La nueva estrategia quedara disponible para seleccion manual.

## Compatibilidad

La estrategia nueva no debe cambiar el comportamiento de:

- `sequential`
- `by_level`
- `by_similarity`
- cronogramas ya guardados
- edicion manual del Gantt
- columnas de predecesoras
- calculo de valorizaciones mensuales

Los datos persistidos solo reciben valores ya soportados por el esquema de generacion y por el API. No se agrega migracion de base de datos.

## Archivos A Modificar

- `types/work-schedule.ts`: extender union de estrategias.
- `lib/validations/work-schedule.ts`: extender schema Zod.
- `lib/work-schedule/intelligent-schedule.ts`: agregar strategy `by_front`, helpers de frente/fase y highlights.
- `lib/work-schedule/intelligent-schedule.test.ts`: agregar cobertura de la nueva estrategia.
- `components/budget/work-schedule-page-content.tsx`: agregar opcion UI y guard de estrategia.
- `components/budget/work-schedule/generation-dialog.tsx`: mantener dialog modular sincronizado.
- `components/budget/work-schedule/utils/storage.ts`: revisar guard si existe duplicado.
- `components/budget/work-schedule-page-content.test.tsx`: validar payload UI.
- `app/api/budgets/[id]/work-schedule/route.test.ts`: validar API con `by_front`.
- `lib/ai/agent/tools/schedule.test.ts`: actualizar solo si alguna validacion enum del agente depende de la lista cerrada.

## Criterios De Aceptacion

- El usuario puede elegir `Por frentes de obra` en el dialog de generacion.
- El API acepta `strategy: "by_front"`.
- El generador produce partidas para multiples frentes iniciando en paralelo cuando no hay enlace `chain`.
- Dentro de un mismo frente, las fases tecnicas se ordenan y encadenan con `FS`.
- El calculo respeta dias laborables y excepciones.
- Las estrategias existentes mantienen sus tests pasando.
- No se introduce `any`.
- La logica nueva queda testeada fuera de UI.
- No se modifica la arquitectura de calculos financieros.

## Riesgos Y Mitigaciones

### Riesgo: Clasificacion Incorrecta Por Texto

Mitigacion: usar reglas conservadoras, fallback `other` y conservar orden original cuando no haya certeza.

### Riesgo: Paralelismo Excesivo

Mitigacion: encadenar siempre dentro del frente y respetar `levelLinkage` cuando exista.

### Riesgo: Mezclar Responsabilidades UI/Calculo

Mitigacion: toda la logica de frentes vive en `lib/work-schedule/intelligent-schedule.ts` o helper puro dentro de `lib/work-schedule`. La UI solo envia la opcion.

### Riesgo: Cambio De Comportamiento En Estrategias Existentes

Mitigacion: tests existentes deben seguir pasando sin cambios funcionales. Los helpers nuevos deben ser llamados solo desde `by_front`.

## Evolucion Posterior

Esta version deja preparada la evolucion a un modo corporativo con:

- Capacidad maxima de cuadrillas por especialidad.
- Restricciones de recursos compartidos entre frentes.
- Calendarios por frente.
- Hitos contractuales.
- Buffers tecnicos.
- Tipos de relacion adicionales: `SS`, `FF`, `SF`.
- Lags automaticos por curado, secado, entrega de materiales o inspecciones.

