# PRD — Colaboración en Tiempo Real para MC Presupuestos

## Documento

**Producto:** MC Presupuestos
**Módulo:** Colaboración en Tiempo Real
**Versión:** V1.0
**Estado:** Propuesto
**Prioridad:** Alta
**Dependencias:** Presupuestos, APU, Autenticación, Multiempresa, Auditoría

---

# 1. Resumen Ejecutivo

La funcionalidad de Colaboración en Tiempo Real permitirá que múltiples usuarios de una misma empresa trabajen simultáneamente sobre presupuestos, APU, metrados y análisis de costos dentro de MC Presupuestos.

El objetivo es eliminar flujos basados en archivos Excel enviados por correo o WhatsApp y convertir el presupuesto en un documento vivo, colaborativo y completamente auditable.

Referencias:

* Google Sheets
* Figma
* Notion
* Linear
* Jira
* Excel Online

---

# 2. Objetivos

## Objetivos Principales

Permitir:

* Edición simultánea de presupuestos
* Comentarios técnicos contextuales
* Historial completo de cambios
* Auditoría por usuario
* Presencia en tiempo real
* Recuperación de versiones anteriores

## Objetivos de Negocio

* Reducir trabajo duplicado
* Mejorar coordinación entre oficina técnica y obra
* Aumentar trazabilidad de modificaciones
* Diferenciar MC Presupuestos frente a soluciones tradicionales

---

# 3. Casos de Uso

## Caso 1 — Elaboración Colaborativa

Juan modifica metrados.

Simultáneamente:

* Ana actualiza precios
* Pedro corrige rendimientos
* María revisa partidas

Todos trabajan sobre el mismo presupuesto sin conflictos.

---

## Caso 2 — Revisión Técnica

Supervisor comenta:

> Revisar rendimiento de excavación para suelo tipo III.

El responsable responde.

La conversación queda asociada a la partida.

---

## Caso 3 — Auditoría

Gerencia consulta:

* Quién realizó el cambio
* Cuándo ocurrió
* Valor anterior
* Valor actual
* Motivo del cambio

---

## Caso 4 — Seguimiento de Equipo

El jefe de costos visualiza:

* Usuarios conectados
* Presupuesto activo
* Elemento editado por cada usuario

---

# 4. Alcance V1

## Incluido

### Presencia en tiempo real

* Usuarios conectados
* Presupuesto abierto
* Elemento actualmente editado

### Comentarios

* Partidas
* APU
* Insumos
* Metrados

### Historial de cambios

* Registro completo
* Usuario responsable
* Fecha y hora

### Diff visual

* Antes
* Después

### Actualización en tiempo real

Cambios visibles inmediatamente para todos los usuarios conectados.

---

## No Incluido

### V2

* Cursores colaborativos tipo Figma
* Chat integrado
* Videollamadas
* Edición offline

---

# 5. Arquitectura

## Frontend

* Next.js
* React Query
* Zustand

## Backend

* Route Handlers
* Server Actions

## Realtime

### Opción Recomendada

Supabase Realtime

o

### Alternativa

Socket.io

## Base de Datos

PostgreSQL

---

# 6. Canales Realtime

## Company Channel

company:{companyId}

Ejemplo:

company:123

---

## Budget Channel

budget:{budgetId}

Ejemplo:

budget:987

---

## APU Channel

apu:{apuId}

Ejemplo:

apu:456

---

# 7. Eventos Realtime

## user_joined

Evento emitido al conectarse.

Payload:

```json
{
  "userId": "uuid",
  "userName": "Juan Perez",
  "companyId": "uuid"
}
```

## user_left

Evento emitido al desconectarse.

Payload:

```json
{
  "userId": "uuid"
}
```

## budget_updated

Evento emitido cuando un usuario modifica información.

Payload:

```json
{
  "budgetId": "uuid",
  "table": "partidas",
  "recordId": "uuid",
  "field": "quantity",
  "value": 120
}
```

## editing_started

Payload:

```json
{
  "userId": "uuid",
  "budgetId": "uuid",
  "entityType": "partida",
  "entityId": "uuid"
}
```

## editing_finished

Payload:

```json
{
  "userId": "uuid",
  "entityType": "partida",
  "entityId": "uuid"
}
```

---

# 8. Presencia de Usuarios

## Objetivo

Visualizar quién está conectado y dónde está trabajando.

## UI

Encabezado del presupuesto:

[JP] [AR] [PM] +2

---

## Tooltip

Juan Perez

Editando:
Excavación para zapatas

---

## Estados

### Conectado

Indicador verde.

### Ausente

Indicador amarillo.

### Desconectado

Indicador gris.

---

# 9. Soft Locking

## Objetivo

Evitar bloqueos completos.

Modelo similar a:

* Google Sheets
* Figma

Cuando alguien edita:

"Ana está editando esta partida"

El resto puede continuar trabajando.

No se implementarán bloqueos duros en V1.

---

# 10. Sistema de Comentarios

## Tabla budget_comments

```sql
CREATE TABLE budget_comments (
  id UUID PRIMARY KEY,
  budget_id UUID NOT NULL,

  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  parent_comment_id UUID,

  content TEXT NOT NULL,

  created_by UUID NOT NULL,

  resolved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## entity_type

Valores:

* budget
* partida
* apu
* insumo
* metrado

---

## Funcionalidades

### Crear comentario

### Responder comentario

### Resolver comentario

### Reabrir comentario

### Menciones

Formato:

@juan

---

# 11. Notificaciones

## Eventos

### Nueva mención

Ana te mencionó en:

Concreto f'c=210 kg/cm²

### Comentario respondido

Pedro respondió tu comentario.

### Comentario resuelto

Tu comentario fue marcado como resuelto.

---

# 12. Auditoría de Cambios

## Tabla audit_log

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,

  company_id UUID NOT NULL,
  user_id UUID NOT NULL,

  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  action TEXT NOT NULL,

  old_value JSONB,
  new_value JSONB,

  created_at TIMESTAMP
);
```

---

## Acciones

* create
* update
* delete
* restore

---

# 13. Registro de Cambios

## Ejemplo

Antes:

```json
{
  "quantity": 100
}
```

Después:

```json
{
  "quantity": 120
}
```

Registro:

```json
{
  "field": "quantity",
  "old": 100,
  "new": 120
}
```

---

# 14. Diff Visual

## Modal

Campo: Cantidad

100

↓

120

---

## Tabla

| Campo    | Antes | Después |
| -------- | ----- | ------- |
| Cantidad | 100   | 120     |
| Precio   | 20.50 | 21.30   |

---

# 15. Versionado

## Tabla budget_versions

```sql
CREATE TABLE budget_versions (
  id UUID PRIMARY KEY,

  budget_id UUID NOT NULL,

  version_number INTEGER NOT NULL,

  snapshot JSONB NOT NULL,

  created_by UUID NOT NULL,

  created_at TIMESTAMP
);
```

---

## Cuándo Crear Snapshots

### Manual

Botón:

Guardar versión

### Automático

* Importación S10
* Publicación
* Aprobación
* Cambios masivos

---

# 16. Restauración

Acción:

Restaurar versión

Genera:

Nueva versión basada en snapshot anterior.

Nunca elimina historial.

---

# 17. Indicadores Visuales

## Cambio remoto

Resaltar celda durante:

2 segundos

---

## Usuario editando

✏️ Ana está editando

---

## Comentarios

💬 4 comentarios

---

## Cambios pendientes

🟡 Cambios sin revisar

---

# 18. Seguridad

## Reglas

Todos los eventos deben validar:

company_id

---

## Restricciones

Un usuario NO puede:

* Escuchar canales de otra empresa
* Ver comentarios de otra empresa
* Ver auditorías de otra empresa
* Ver usuarios de otra empresa

---

# 19. Performance

## Objetivos

| Métrica               | Objetivo    |
| --------------------- | ----------- |
| Latencia realtime     | < 300 ms    |
| Actualización UI      | < 500 ms    |
| Carga comentarios     | < 500 ms    |
| Carga historial       | < 1 segundo |
| Usuarios concurrentes | 100+        |

---

# 20. Integración con Khipu IA

## Comentarios Generados por IA

Ejemplo:

💡 Khipu recomienda revisar el rendimiento de excavación por posible desviación respecto al histórico.

---

## Auditoría IA

Registrar:

Cambio sugerido por Khipu

---

## Futuro

Permitir:

Solicitar revisión técnica IA directamente desde una partida.

---

# 21. Roadmap

## V1

* Comentarios
* Presencia de usuarios
* Auditoría
* Historial
* Diff visual
* Realtime básico

## V1.5

* Menciones
* Notificaciones
* Snapshots automáticos

## V2

* Cursores colaborativos tipo Figma
* Edición simultánea avanzada
* Resolución de conflictos
* Actividad en tiempo real

## V3

* Chat contextual
* IA colaborativa
* Timeline completo de proyecto

---

# 22. Criterios de Aceptación

## Presencia

* Usuario visible en menos de 2 segundos.
* Desconexión reflejada en menos de 10 segundos.

## Comentarios

* Crear comentarios.
* Responder comentarios.
* Resolver comentarios.

## Historial

* Todo cambio debe registrarse.
* Debe mostrarse diff visual.

## Realtime

* Cambios visibles para otros usuarios en menos de 500 ms.

## Seguridad

* Aislamiento completo por company_id.

## Auditoría

* Ningún cambio puede realizarse sin trazabilidad.

---

# 23. Plan de Implementación Recomendado

## Sprint 1

* Audit Log
* Historial de cambios

## Sprint 2

* Comentarios
* Panel lateral

## Sprint 3

* Presencia de usuarios
* Indicadores visuales

## Sprint 4

* Realtime con Supabase Realtime

## Sprint 5

* Diff visual
* Snapshots

## Sprint 6

* Integración Khipu IA
* Menciones
* Notificaciones
