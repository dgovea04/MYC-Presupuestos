# Global AI Assistant Design

**Fecha:** 2026-06-17

**Objetivo**

Implementar Khipu como un asistente flotante global en la webapp, visible en la esquina inferior derecha, capaz de mantenerse disponible durante la navegación, tomar contexto de la vista actual y ejecutar requests/responses en vivo usando la infraestructura de IA existente.

## Alcance

Este diseño cubre:

- Widget flotante global de chat técnico
- Integración visual en toda la zona autenticada de la app
- Captura de contexto de la vista actual
- Reutilización del motor actual de Khipu
- Streaming en vivo de respuestas
- Persistencia de historial y feedback por proyecto

Este diseño no cubre:

- Nuevas capacidades de modelos o proveedores
- Automatización de acciones complejas sobre la UI
- Soporte inicial para adjuntos, voz o capturas de pantalla

## Estado actual

La aplicación ya cuenta con una base funcional de IA:

- `components/ai/AIWorkspace.tsx` contiene la UI principal, lógica de estado, streaming, historial y feedback
- `app/ai/page.tsx` expone una experiencia de página completa para Khipu
- `app/api/ai/chat/stream/route.ts` ya soporta respuestas por streaming
- `app/api/ai/execute/route.ts` ya soporta ejecución no streaming y persistencia de historial
- `lib/ai/context/assembled-context.ts` ya ensambla contexto de proyecto, historial, memoria y evidencia

Limitaciones detectadas:

- El acceso actual a Khipu está centrado en una página dedicada
- El contexto inicial del chat depende de props o query params
- No existe una capa global para publicar el contexto de la vista activa
- `AppShell` no se monta desde un único layout global, sino manualmente por página

## Objetivos de producto

El asistente debe sentirse como una ayuda permanente dentro de la app, no como un módulo aislado.

Debe permitir:

- Consultar dudas técnicas sin abandonar la pantalla actual
- Entender en qué módulo está trabajando el usuario
- Reconocer selección, tabla activa o entidad relevante cuando exista
- Responder en vivo con streaming
- Reutilizar historial y memoria del proyecto cuando aplique

## Enfoque recomendado

Se recomienda una arquitectura en tres capas:

1. **Capa global de presencia**
   Un provider cliente se monta en `app/layout.tsx` y renderiza el asistente flotante al final del `body`.

2. **Capa compartida de motor**
   La lógica hoy acoplada a `AIWorkspace` se extrae a un controlador reutilizable para que la experiencia de página completa y el widget flotante compartan comportamiento.

3. **Capa de contexto vivo**
   Cada vista relevante publica su contexto actual a un registro global del asistente. Ese contexto se envía al backend y se enriquece antes de consultar al proveedor de IA.

## Arquitectura propuesta

### 1. Montaje global

Agregar un componente cliente global, por ejemplo `GlobalAiAssistantProvider`, desde `app/layout.tsx`.

Responsabilidades:

- Mantener el estado global del asistente
- Exponer API interna para registrar contexto de pantalla
- Renderizar el botón flotante y el panel expandido
- Persistir estado mínimo de apertura/cierre y sesión visual

La elección de `app/layout.tsx` es intencional: garantiza cobertura real sobre toda la app, incluso donde no haya integración explícita con `AppShell`.

### 2. Widget flotante

Agregar un componente `FloatingAiAssistant` anclado abajo a la derecha.

Estados:

- Minimizado: botón flotante con icono Khipu/IA
- Expandido: panel tipo chat con header, contexto detectado, conversación y acciones rápidas

Comportamiento:

- Debe conservar estado durante navegación si el layout raíz no se desmonta
- Debe adaptarse a móvil con panel más alto o experiencia tipo bottom sheet
- Debe evitar tapar CTAs, drawers o controles críticos

### 3. Reutilización del motor actual

Refactorizar `AIWorkspace` en piezas reutilizables:

- Un controlador de estado, requests y streaming
- Una UI panel reutilizable
- Una composición full-page para `app/ai/page.tsx`

Separación sugerida:

- `use-ai-assistant-controller.ts`
- `ai-assistant-panel.tsx`
- `floating-ai-assistant.tsx`
- `AIWorkspace.tsx` como ensamblaje de pantalla completa

Esto evita duplicar:

- manejo de streaming
- historial
- feedback
- health/providers
- fallback entre endpoints

### 4. Registro de contexto de vista

Crear una API de publicación de contexto desde cliente.

Responsabilidades:

- Registrar contexto actual por ruta/pantalla
- Permitir actualizaciones reactivas cuando cambia la selección
- Exponer el contexto vigente al widget flotante

Datos base propuestos:

- `route`
- `projectId`
- `budgetId`
- `module`
- `activeTable`
- `selectedItem`
- `selectionType`
- `selectionId`
- `unit`
- `currentCost`
- `viewSummary`

Los campos actuales de `AiContext` deben ampliarse para cubrir esta necesidad sin perder compatibilidad con la experiencia existente.

### 5. Enriquecimiento backend

El cliente no debe enviar todo el contexto textual final como fuente única.

El cliente debe enviar:

- contexto detectado
- ids relevantes
- resumen breve de vista si ya está disponible

El backend debe enriquecer ese contexto con:

- resumen de proyecto
- historial reciente del proyecto
- memoria del proyecto
- evidencia de retrieval
- datos de entidad actual si se conoce `projectId`, `budgetId` o selección activa

Esto se integra sobre `lib/ai/context/assembled-context.ts` para no romper la arquitectura actual.

## Contexto por vistas

La primera iteración debe cubrir las vistas con mayor valor operativo:

- presupuesto
- proyecto
- partidas
- recursos
- metrados
- dashboard

Cada una tendrá un adaptador de contexto pequeño.

Ejemplos:

- En presupuesto: tabla activa, subpresupuesto actual, partida seleccionada, unidad y costo actual
- En proyecto: nombre, cliente, estado, último presupuesto vinculado
- En recursos: recurso seleccionado, categoría, unidad y costo
- En metrados: hoja o fórmula activa, fila actual, unidad asociada

## Streaming y requests en vivo

El asistente flotante debe usar la misma política que la UI actual:

- chat técnico con streaming preferente
- fallback a endpoint no streaming si aplica
- soporte para historial por proyecto

No se propone un canal websocket en esta fase. El streaming SSE actual es suficiente para el alcance.

## UX propuesta

### Minimizado

- Botón circular o rounded-xl
- Ubicado en esquina inferior derecha
- Elevación sutil y lenguaje visual consistente con MYC
- Indicador opcional cuando hay contexto reconocido o respuesta pendiente

### Expandido

El panel debe mostrar:

- título corto, por ejemplo `Khipu`
- subtítulo con módulo/contexto actual
- badge del proyecto o vista
- mensajes del chat
- caja de entrada
- acciones rápidas

Acciones rápidas iniciales:

- `Explica esta vista`
- `Revisa esta selección`
- `Resume riesgos`
- `Sugiere siguiente paso`

### Experiencia móvil

- Mantener botón inferior derecho
- Al abrir, usar panel grande tipo sheet con buen alto visible
- Respetar safe areas y teclado virtual

## Rutas y visibilidad

El widget debe aparecer por defecto en zonas autenticadas.

Debe ocultarse al menos en:

- `/login`
- `/register`

La landing pública puede quedar fuera en primera fase para evitar complejidad innecesaria.

## Testing

La implementación debe cubrir:

- render global del asistente
- apertura/cierre del widget
- conservación del contexto al navegar
- publicación de contexto desde vistas
- requests con contexto enriquecido
- streaming parcial y final
- fallback cuando streaming falla
- reglas de visibilidad por ruta

## Riesgos

### Riesgo 1: widget global sin contexto útil

Si el widget se monta globalmente pero las vistas no publican contexto, el resultado será un chat ubicuo pero pobre.

Mitigación:

- implementar adaptadores por vista desde la primera fase

### Riesgo 2: duplicación de lógica

Si se crea otro chat paralelo al `AIWorkspace`, la deuda técnica crecerá rápido.

Mitigación:

- extraer un controlador compartido y reutilizar endpoints actuales

### Riesgo 3: exceso de contexto enviado desde cliente

Enviar demasiado texto directo desde la UI puede volver inestable el prompt.

Mitigación:

- enviar contexto estructurado mínimo y enriquecer en servidor

## Plan de rollout recomendado

### Fase 1

- Widget global visible
- Chat técnico
- Contexto básico por ruta
- Streaming reutilizado

### Fase 2

- Adaptadores enriquecidos para presupuesto, partidas y recursos
- Mejor resumen contextual
- Acciones rápidas según módulo

### Fase 3

- Mayor profundidad de contexto por selección
- Sugerencias proactivas
- Integraciones con flujos asistidos específicos

## Decisiones tomadas

- El punto de montaje será `app/layout.tsx`
- Se reutilizará el stack actual de Khipu
- Se mantendrá SSE para respuestas en vivo
- El contexto será híbrido: capturado en cliente y enriquecido en servidor
- La primera versión priorizará zonas autenticadas y módulos de mayor uso

## Resultado esperado

El usuario tendrá un asistente técnico persistente, moderno y contextual, disponible desde cualquier pantalla relevante, sin romper la arquitectura existente de MYC Presupuestos y aprovechando la infraestructura actual de IA.
