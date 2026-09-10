# PRD — MC Knowledge Perú V0

**Proyecto:** Mercado y Construcción  
**Producto / Capa:** MC Knowledge Perú  
**Versión:** 0.1  
**Estado:** Draft para implementación  
**Fecha:** 2026-09-06  
**Mercado inicial:** Perú  
**Idioma:** Español  
**Tipo de documento:** Product Requirements Document + Architecture Specification

---

# 1. Resumen ejecutivo

MC Knowledge Perú será la capa estructurada de conocimiento técnico, económico y contextual que servirá como infraestructura común para MC Presupuestos, MC Revisor, Khipu y futuros productos de Mercado y Construcción.

Su objetivo no es crear una “base de precios” aislada ni un catálogo estático de APU. El objetivo es construir progresivamente un sistema de conocimiento de construcción peruana que pueda registrar, estructurar, versionar, relacionar, validar y reutilizar información proveniente de proyectos reales, presupuestos, documentos técnicos, usuarios, fuentes públicas y procesos de revisión humana.

La tesis central es:

> **El conocimiento no debe almacenarse únicamente como valores finales, sino como observaciones con contexto, evidencia, procedencia, fecha, región, alcance y nivel de confianza.**

La arquitectura debe permitir que cada uso real de MC Presupuestos y MC Revisor genere eventos estructurados que puedan convertirse en conocimiento reutilizable, sin mezclar indiscriminadamente datos privados de usuarios, empresas y proyectos con conocimiento global.

MC Knowledge Perú será inicialmente una **infraestructura interna**. Más adelante, parte de esta infraestructura podrá alimentar un producto visible como **MC Data Perú**, orientado a históricos, benchmarking, anomalías, inteligencia de costos y datos del mercado.

---

# 2. Contexto estratégico

Mercado y Construcción ya cuenta con dos fuentes naturales de conocimiento:

- **MC Presupuestos**, donde los usuarios crean, importan, editan y confirman presupuestos, APU, recursos, rendimientos y precios.
- **MC Revisor V0**, donde se relacionan documentos, partidas, unidades, metrados, especificaciones y posibles inconsistencias.

La siguiente ventaja competitiva no debe depender solamente de la interfaz ni del modelo de IA utilizado.

Debe construirse una capa propia capaz de representar:

```text
Partida
   ↓
APU base
   ↓
Recursos
   ↓
Rendimiento / Precio / Tarifa
   ↓
Región / Proveedor / Fecha / Evidencia / RUC
   ↓
Histórico
   ↓
Benchmark / Anomalías
```

El sistema debe crecer orgánicamente con el uso del producto.

Ejemplo:

```text
APU utilizado
      ↓
sugerencia Khipu
      ↓
ingeniero modifica
      ↓
corrección registrada
      ↓
KnowledgeEvent
      ↓
MC Knowledge Perú
```

El principio de producto es:

> **La plataforma debe aprender del feedback estructurado y de la evidencia, no únicamente de conversaciones con un LLM.**

---

# 3. Problema

Actualmente, muchos sistemas de presupuestos almacenan información como registros finales:

- una partida;
- una unidad;
- un precio;
- un rendimiento;
- un APU;
- un proveedor.

Sin embargo, para crear inteligencia útil, MC necesita conocer también:

- de dónde provino el dato;
- quién lo confirmó;
- en qué proyecto fue utilizado;
- en qué región;
- en qué fecha;
- con qué unidad;
- bajo qué condiciones;
- si fue importado o ingresado manualmente;
- si fue sugerido por IA;
- si fue corregido posteriormente;
- si existe evidencia documental;
- si existen observaciones similares;
- qué nivel de confianza debe asignarse.

Por ejemplo:

```text
Cemento Portland Tipo I
Precio: S/ 31.50
```

no constituye conocimiento suficiente.

Debe registrarse como:

```text
Recurso:
Cemento Portland Tipo I

Valor:
31.50 PEN

Unidad:
BOL

Región:
Cusco

Fecha:
2026-09-03

Proveedor:
Proveedor X

Fuente:
Cotización

Evidencia:
PDF de cotización

RUC:
...

Estado:
Confirmado

Confidence:
High
```

El sistema podrá posteriormente calcular históricos, rangos, benchmarks o tendencias a partir de múltiples observaciones.

---

# 4. Objetivo del producto

Construir la primera versión del sistema de conocimiento estructurado de Mercado y Construcción para Perú, capaz de:

1. almacenar entidades técnicas canónicas;
2. registrar observaciones con contexto;
3. capturar cambios relevantes mediante Knowledge Events;
4. conservar provenance y evidencia;
5. separar conocimiento global, empresarial y de proyecto;
6. versionar APU y datos relevantes;
7. identificar entidades equivalentes o similares;
8. permitir recuperación estructurada para Khipu y MC Revisor;
9. preparar la infraestructura para históricos, benchmarking y anomalías;
10. evitar contaminación de la base global mediante datos no validados.

---

# 5. Objetivos de V0

MC Knowledge Perú V0 debe permitir:

- definir una ontología inicial simple;
- registrar Partidas canónicas;
- registrar Recursos canónicos;
- almacenar APU y versiones de APU;
- almacenar observaciones de precios;
- almacenar observaciones de rendimientos;
- registrar regiones;
- registrar proveedores;
- registrar RUC cuando exista;
- conservar fuente y evidencia;
- registrar Knowledge Events;
- separar scopes;
- evitar promoción automática hacia Global Knowledge;
- permitir consultas desde servicios internos;
- permitir integrar MC Presupuestos y MC Revisor progresivamente.

---

# 6. Fuera de alcance V0

No construir en esta fase:

- marketplace de proveedores;
- sistema de compras;
- ERP;
- scraping masivo;
- integración SUNAT completa;
- API comercial pública;
- dashboard avanzado MC Data;
- benchmarking público;
- machine learning dedicado;
- fine-tuning automático;
- pricing engine predictivo;
- normalización perfecta de todo el catálogo;
- integración BIM;
- integración automática con S10;
- comparación de proveedores en tiempo real;
- precios “oficiales” únicos;
- recomendaciones automáticas sin revisión humana.

---

# 7. Principios de diseño

## 7.1 Knowledge is not Truth

Un dato observado no se convierte automáticamente en verdad.

```text
Observation ≠ Knowledge ≠ Canonical Knowledge
```

---

## 7.2 Observation First

Precios, rendimientos y valores técnicos deben almacenarse inicialmente como observaciones.

Ejemplo:

```text
PriceObservation
YieldObservation
UnitObservation
ResourceUsageObservation
```

---

## 7.3 Provenance First

Todo dato relevante debe poder responder:

> ¿De dónde provino?

No debe existir conocimiento de costo confiable sin provenance.

---

## 7.4 Human in the Loop

El sistema puede:

- sugerir;
- clasificar;
- relacionar;
- detectar anomalías;
- proponer canonicalización.

Pero las promociones de conocimiento sensible deben poder requerir confirmación humana.

---

## 7.5 Tenant Isolation

La información de una empresa no debe utilizarse como conocimiento global de manera automática.

---

## 7.6 Structured Before Vector

La mayor parte del conocimiento se almacenará de forma estructurada.

Los embeddings serán complementarios para búsqueda semántica y resolución de entidades.

---

## 7.7 Version Everything Important

APU, relaciones, valores canónicos y conocimiento promocionado deben poder versionarse.

---

## 7.8 Deterministic Calculations

Los cálculos críticos deben permanecer en motores determinísticos, no en el LLM.

---

## 7.9 Auditability

Cada cambio relevante debe dejar rastro.

---

# 8. Modelo conceptual de conocimiento

MC Knowledge Perú manejará cuatro niveles:

```text
GLOBAL KNOWLEDGE
        │
        ▼
COMPANY KNOWLEDGE
        │
        ▼
PROJECT KNOWLEDGE
        │
        ▼
USER WORKING CONTEXT
```

Estos niveles no deben mezclarse automáticamente.

---

# 9. Scope: Global Knowledge

Conocimiento reutilizable por la plataforma.

Ejemplos:

- partidas normalizadas;
- recursos normalizados;
- unidades;
- categorías;
- regiones;
- proveedores públicos;
- APU de referencia;
- históricos agregados;
- benchmarks;
- relaciones técnicas validadas.

Regla:

> Ningún dato privado de Company o Project puede promocionarse automáticamente a Global.

---

# 10. Scope: Company Knowledge

Conocimiento privado de una empresa.

Ejemplos:

- catálogo interno;
- APU propios;
- rendimientos históricos;
- proveedores preferidos;
- precios negociados;
- cotizaciones;
- estándares;
- nomenclaturas;
- reglas internas.

---

# 11. Scope: Project Knowledge

Conocimiento específico de un proyecto.

Ejemplos:

- partidas utilizadas;
- APU utilizados;
- precios del proyecto;
- metrados;
- especificaciones;
- proveedores;
- cotizaciones;
- documentos;
- decisiones;
- correcciones.

---

# 12. Scope: User Working Context

Contexto temporal y operativo.

Ejemplos:

- partida activa;
- APU abierto;
- documento consultado;
- sugerencia Khipu pendiente;
- cambios no confirmados.

Este contexto no debe considerarse conocimiento persistente salvo que una acción explícita lo convierta en evento.

---

# 13. Ontología V0

La ontología inicial debe mantenerse pequeña.

Entidades principales:

```text
CanonicalItem
APU
APUVersion
Resource
ResourceCategory
Unit
Region
Supplier
PriceObservation
YieldObservation
Source
Evidence
KnowledgeEvent
KnowledgeAssertion
```

---

# 14. CanonicalItem

Representa una partida técnica normalizada.

Ejemplo:

```text
CanonicalItem

name:
Excavación manual de zanjas

aliases:
- EXCAVACION MANUAL DE ZANJAS
- EXC. MANUAL ZANJAS
- EXCAVACION DE ZANJA MANUAL

canonicalUnit:
M3

classification:
Movimiento de tierras
```

## Requisitos

Debe permitir:

- múltiples aliases;
- unidad canónica;
- categoría;
- especialidad;
- estado;
- versión;
- embeddings opcionales;
- relación con APU;
- relación con observaciones;
- relación con Knowledge Events.

---

# 15. Canonicalización de partidas

El sistema podrá detectar candidatos equivalentes mediante:

1. normalización textual;
2. reglas determinísticas;
3. aliases;
4. similitud semántica;
5. sugerencia IA;
6. revisión humana.

Flujo:

```text
Raw Item
   ↓
Normalize Text
   ↓
Candidate Search
   ↓
Similarity Score
   ↓
Candidate List
   ↓
Human Confirm
   ↓
CanonicalItem Link
```

No debe realizar merge destructivo automático en V0.

---

# 16. Resource

Representa un recurso canónico.

Tipos iniciales:

```text
MATERIAL
LABOR
EQUIPMENT
SUBCONTRACT
TOOL
OTHER
```

Ejemplo:

```text
Resource

name:
Cemento Portland Tipo I

category:
MATERIAL

canonicalUnit:
BOL
```

---

# 17. Resource Alias

Debe existir capacidad para relacionar nombres alternativos:

```text
Cemento Portland T-I
Cemento Tipo I
Cemento Portland Tipo 1
```

con una única entidad canónica cuando sea confirmado.

---

# 18. APU

Un APU no debe ser una entidad estática.

Debe considerarse una entidad versionada.

```text
APU
   │
   ├── Version 1
   ├── Version 2
   └── Version 3
```

Cada versión debe poder conservar:

- partida;
- unidad;
- recursos;
- cantidades;
- coeficientes;
- rendimiento;
- cuadrilla;
- fuente;
- autor;
- fecha;
- scope;
- estado;
- provenance.

---

# 19. APU Versioning

Los cambios relevantes deben generar nueva versión cuando:

- cambia recurso;
- cambia cantidad;
- cambia rendimiento;
- cambia cuadrilla;
- cambia unidad;
- cambia estructura significativa.

Cambios meramente descriptivos podrán actualizar metadata sin generar una versión completa si se define así posteriormente.

---

# 20. PriceObservation

Nunca almacenar un único “precio correcto”.

Modelo conceptual:

```text
PriceObservation

resourceId
value
currency
unit
regionId
supplierId
observedAt
validFrom?
validTo?
sourceId
evidenceId?
projectId?
companyId?
confidence
status
```

---

# 21. Tipos de fuente de precio

Valores iniciales:

```text
USER_ENTRY
IMPORT
QUOTATION
INVOICE
SUPPLIER_LIST
PUBLIC_SOURCE
PROJECT_HISTORY
AI_EXTRACTED
SYSTEM
```

---

# 22. YieldObservation

Representa una observación de rendimiento.

```text
YieldObservation

canonicalItemId
apuVersionId?
value
unit
crew?
projectType?
regionId?
projectId?
companyId?
sourceId
evidenceId?
observedAt
confidence
status
```

---

# 23. Supplier

Entidad proveedor.

Campos iniciales:

```text
id
name
legalName?
ruc?
regionId?
website?
phone?
email?
source?
status
createdAt
updatedAt
```

V0 no intenta convertirse en directorio comercial.

---

# 24. Region

La arquitectura debe soportar jerarquía geográfica.

Inicialmente:

```text
Country
  ↓
Department
  ↓
Province
  ↓
District
```

No es obligatorio poblar todos los distritos en V0, pero el modelo debe soportarlo.

---

# 25. Source

Representa el origen lógico de la información.

Ejemplos:

- presupuesto;
- Excel;
- cotización;
- PDF;
- especificación técnica;
- fuente pública;
- usuario;
- importación;
- MC Revisor;
- Khipu.

---

# 26. Evidence

Representa evidencia verificable.

Campos:

```text
sourceId
documentId?
fileName?
page?
sheet?
cellRange?
url?
quote?
checksum?
metadata?
```

Debe permitir relaciones con:

- PriceObservation;
- YieldObservation;
- KnowledgeAssertion;
- KnowledgeEvent.

---

# 27. Provenance

Provenance no será un simple campo texto.

Debe ser una estructura consultable.

Cada observación debe poder responder:

```text
WHAT
WHO
WHEN
WHERE
SOURCE
EVIDENCE
METHOD
CONFIDENCE
```

Ejemplo:

```text
Precio:
S/ X

Recurso:
Cemento Tipo I

Región:
Cusco

Proveedor:
Proveedor X

Fecha:
2026-09-03

Fuente:
Cotización

Documento:
cotizacion-x.pdf

Página:
1

Extraído por:
MC Revisor

Confirmado por:
User

Confidence:
HIGH
```

---

# 28. KnowledgeEvent

KnowledgeEvent será el núcleo de captura de aprendizaje.

Eventos iniciales:

```text
APU_CREATED
APU_UPDATED

RESOURCE_ADDED
RESOURCE_REMOVED
RESOURCE_REPLACED

YIELD_CHANGED

PRICE_ADDED
PRICE_UPDATED

UNIT_CHANGED

ITEM_CANONICAL_LINKED
RESOURCE_CANONICAL_LINKED

IMPORT_COMPLETED

AI_SUGGESTION_CREATED
AI_SUGGESTION_ACCEPTED
AI_SUGGESTION_MODIFIED
AI_SUGGESTION_REJECTED

REVIEW_ISSUE_CREATED
REVIEW_ISSUE_CONFIRMED
REVIEW_ISSUE_REJECTED

EVIDENCE_LINKED

KNOWLEDGE_PROMOTED
KNOWLEDGE_DEPRECATED
```

---

# 29. Estructura de KnowledgeEvent

Modelo conceptual:

```ts
interface KnowledgeEvent {
  id: string;

  eventType: KnowledgeEventType;

  scope: KnowledgeScope;

  companyId?: string;
  projectId?: string;
  userId?: string;

  entityType: string;
  entityId: string;

  previousValue?: unknown;
  newValue?: unknown;

  sourceType: KnowledgeSourceType;
  sourceId?: string;
  evidenceId?: string;

  metadata?: Record<string, unknown>;

  createdAt: Date;
}
```

---

# 30. Evento ≠ Conocimiento

Regla crítica:

```text
KnowledgeEvent
      ≠
KnowledgeAssertion
      ≠
Canonical Knowledge
```

Un evento representa evidencia de que ocurrió algo.

Una assertion representa una afirmación.

El conocimiento canónico es una afirmación suficientemente validada.

---

# 31. KnowledgeAssertion

Entidad destinada a representar conocimiento derivado.

Ejemplo:

```text
CanonicalItem:
Conformación de terraplenes

Assertion:
ExpectedUnit = M3

EvidenceCount:
127

Status:
VERIFIED

Confidence:
VERY_HIGH
```

---

# 32. Lifecycle de KnowledgeAssertion

Estados iniciales:

```text
OBSERVED
CONFIRMED
VERIFIED
CANONICAL
DEPRECATED
REJECTED
```

Flujo:

```text
OBSERVED
    ↓
CONFIRMED
    ↓
VERIFIED
    ↓
CANONICAL
```

No todas las observaciones deben llegar a CANONICAL.

---

# 33. Reglas de promoción

## Project → Company

Puede ocurrir cuando:

- un usuario autorizado lo confirma;
- existe política empresarial;
- el dato es explícitamente reutilizable.

## Company → Global

No automático.

Puede requerir:

- consentimiento;
- anonimización;
- reglas de privacidad;
- agregación;
- revisión;
- umbral de evidencia.

## Project → Global

Prohibido automáticamente.

---

# 34. Confidence Model V0

V0 no necesita una fórmula matemática compleja.

Debe soportar niveles:

```text
VERY_LOW
LOW
MEDIUM
HIGH
VERY_HIGH
```

Factores conceptuales:

```text
source quality
human confirmation
evidence
recency
consistency
independent observations
scope
```

---

# 35. Confidence futuro

Posteriormente:

```text
confidence =
sourceQuality
× evidenceStrength
× recency
× confirmations
× independence
× consistency
```

No implementar esta fórmula sin datos suficientes.

---

# 36. Fuente y confianza

Orientación inicial:

| Fuente | Confianza inicial |
|---|---|
| Inferencia LLM | baja |
| Entrada manual sin evidencia | baja/media |
| Excel importado | media |
| APU utilizado | media |
| Usuario confirmado | alta |
| Cotización adjunta | alta |
| Documento técnico con página | muy alta |
| Fuente oficial | muy alta |

Estos valores son semánticos, no scores definitivos.

---

# 37. Arquitectura lógica

```text
MC Presupuestos
       │
MC Revisor
       │
Khipu
       │
       ▼
Knowledge Events
       │
       ▼
MC Knowledge Engine
       │
       ├── Normalize
       ├── Resolve Entities
       ├── Validate
       ├── Deduplicate
       ├── Score
       ├── Aggregate
       └── Version
       │
       ▼
MC Knowledge Store
       │
       ├── Global
       ├── Company
       └── Project
       │
       ▼
Knowledge Retrieval API
       │
       ├── Khipu
       ├── MC Revisor
       └── MC Presupuestos
```

---

# 38. MC Knowledge Engine

Responsabilidades:

- aceptar eventos;
- validar schema;
- normalizar datos;
- buscar entidad canónica;
- detectar posibles duplicados;
- generar candidatos;
- asociar provenance;
- actualizar índices;
- crear assertions;
- versionar conocimiento;
- ejecutar reglas de promoción;
- preparar datos para retrieval.

No debe:

- modificar presupuestos automáticamente;
- tomar decisiones profesionales finales;
- convertir sugerencias IA en conocimiento global sin validación.

---

# 39. Normalization Layer

Debe normalizar:

- mayúsculas/minúsculas;
- espacios;
- acentos cuando corresponda;
- unidades;
- abreviaturas comunes;
- monedas;
- nombres de regiones;
- identificadores;
- RUC.

Debe conservar siempre el valor original.

Ejemplo:

```text
rawName:
"EXC. MANUAL ZANJAS"

normalizedName:
"excavacion manual zanjas"
```

---

# 40. Entity Resolution

V0 debe producir candidatos, no realizar merges agresivos.

Ejemplo:

```text
Incoming:
EXCAVACION MANUAL EN ZANJA

Candidates:

1.
Excavación manual de zanjas
score: 0.93

2.
Excavación de zanjas para cimentación
score: 0.81
```

El usuario o sistema autorizado confirma.

---

# 41. Deduplication

Aplicar deduplicación a:

- partidas;
- recursos;
- proveedores;
- observaciones importadas;
- eventos repetidos.

KnowledgeEvent debe soportar idempotency key.

---

# 42. Idempotency

Ejemplo:

```text
import file
     ↓
process
     ↓
network retry
     ↓
process again
```

No debe generar observaciones duplicadas.

Agregar:

```text
idempotencyKey
```

donde corresponda.

---

# 43. Storage recomendado

V0:

```text
PostgreSQL
+
Prisma
+
pgvector opcional
+
Object Storage
```

PostgreSQL debe ser la fuente primaria para conocimiento estructurado.

Object Storage:

- PDFs;
- cotizaciones;
- archivos fuente;
- evidencia.

pgvector:

- semantic matching;
- canonical candidates;
- similarity search.

---

# 44. Embeddings

No almacenar embeddings para todo indiscriminadamente.

Candidatos iniciales:

- CanonicalItem;
- Resource;
- fragmentos técnicos relevantes;
- aliases;
- especificaciones.

---

# 45. Estrategia de búsqueda

Retrieval debe combinar:

```text
Structured filters
+
Exact matching
+
Alias matching
+
Semantic similarity
+
Scope precedence
+
Confidence
+
Recency
```

---

# 46. Scope precedence

Al responder a un usuario:

```text
Project
   ↓
Company
   ↓
Global
```

El dato más cercano no siempre reemplaza al global.

El sistema puede presentar ambos.

Ejemplo:

```text
Empresa:
Rendimiento habitual = X

Referencia global:
Rango observado = Y–Z
```

---

# 47. Knowledge Retrieval API

V0 debe exponer servicios internos.

Ejemplos:

```text
findCanonicalItem()

findCanonicalResource()

getApuCandidates()

getResourcePriceObservations()

getYieldObservations()

getKnowledgeAssertions()

getSupplierObservations()

searchKnowledge()
```

---

# 48. Ejemplo: recuperación de precios

Request conceptual:

```json
{
  "resourceId": "...",
  "region": "Cusco",
  "from": "2026-06-01",
  "to": "2026-09-06",
  "scope": ["PROJECT", "COMPANY", "GLOBAL"]
}
```

Response:

```text
observations
count
median
min
max
source distribution
confidence distribution
```

En V0, los agregados pueden calcularse bajo demanda.

---

# 49. Integración con MC Presupuestos

MC Presupuestos debe convertirse en el principal productor de eventos.

Acciones iniciales:

```text
Crear APU
Modificar APU
Agregar recurso
Eliminar recurso
Cambiar recurso
Cambiar rendimiento
Agregar precio
Actualizar precio
Importar presupuesto
Confirmar partida
Cambiar unidad
```

Cada acción relevante genera KnowledgeEvent.

---

# 50. Integración no bloqueante

El sistema de conocimiento no debe degradar la experiencia principal.

Recomendación:

```text
User Action
   ↓
Business Transaction
   ↓
Domain Event
   ↓
Knowledge Processing
```

El flujo principal no debería esperar procesamiento pesado.

---

# 51. Integración con MC Revisor V0

MC Revisor puede producir:

```text
REVIEW_ISSUE_CREATED
REVIEW_ISSUE_CONFIRMED
REVIEW_ISSUE_REJECTED

UNIT_MISMATCH_CONFIRMED
ITEM_LINK_CONFIRMED
SPECIFICATION_LINK_CONFIRMED
```

Ejemplo:

```text
Presupuesto:
Conformación de terraplenes
Unidad M2

Especificación:
Unidad M3

Engineer:
corrige M2 → M3
```

Resultado:

```text
KnowledgeEvent

entity:
CanonicalItem

claim:
Expected unit = M3

evidence:
specification page X

humanConfirmed:
true
```

---

# 52. Integración con Khipu

Khipu debe consumir conocimiento, no contenerlo.

Flujo:

```text
User
   ↓
Khipu
   ↓
Knowledge Retrieval
   ↓
Project Knowledge
Company Knowledge
Global Knowledge
   ↓
Deterministic Engine
   ↓
LLM
   ↓
Suggestion
```

---

# 53. Khipu Suggestions como Events

Estados:

```text
CREATED
ACCEPTED
MODIFIED
REJECTED
```

Si el usuario modifica:

```text
Suggestion
   ↓
Human Diff
   ↓
KnowledgeEvent
```

Esto permite aprender qué partes de una sugerencia fueron incorrectas.

---

# 54. No fine-tuning en V0

No implementar:

```text
User correction
   ↓
automatic model training
```

Implementar:

```text
User correction
   ↓
structured event
   ↓
knowledge store
   ↓
retrieval
   ↓
future Khipu context
```

---

# 55. Modelo Prisma — propuesta conceptual

## KnowledgeScope

```prisma
enum KnowledgeScope {
  GLOBAL
  COMPANY
  PROJECT
  USER
}
```

## KnowledgeStatus

```prisma
enum KnowledgeStatus {
  OBSERVED
  CONFIRMED
  VERIFIED
  CANONICAL
  DEPRECATED
  REJECTED
}
```

## ConfidenceLevel

```prisma
enum ConfidenceLevel {
  VERY_LOW
  LOW
  MEDIUM
  HIGH
  VERY_HIGH
}
```

---

# 56. Prisma — CanonicalItem

Modelo inicial conceptual:

```prisma
model CanonicalItem {
  id              String   @id @default(cuid())
  name            String
  normalizedName  String
  canonicalUnitId String?
  classification  String?
  specialty       String?
  status          KnowledgeStatus @default(OBSERVED)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

La implementación final debe incorporar relaciones y tenancy según el schema existente.

---

# 57. Prisma — Resource

```prisma
model KnowledgeResource {
  id              String   @id @default(cuid())
  name            String
  normalizedName  String
  category        String
  canonicalUnitId String?

  status          KnowledgeStatus @default(OBSERVED)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Usar nombre específico si `Resource` ya existe en MC Presupuestos.

---

# 58. Prisma — PriceObservation

```prisma
model PriceObservation {
  id          String   @id @default(cuid())

  resourceId  String

  value       Decimal
  currency    String
  unitId      String

  regionId    String?
  supplierId  String?

  companyId   String?
  projectId   String?

  sourceId    String?
  evidenceId  String?

  observedAt  DateTime

  scope       KnowledgeScope
  status      KnowledgeStatus
  confidence  ConfidenceLevel

  createdAt   DateTime @default(now())
}
```

---

# 59. Prisma — YieldObservation

```prisma
model YieldObservation {
  id              String @id @default(cuid())

  canonicalItemId String
  apuVersionId    String?

  value           Decimal
  unit            String

  regionId        String?
  companyId       String?
  projectId       String?

  sourceId        String?
  evidenceId      String?

  observedAt      DateTime

  scope           KnowledgeScope
  status          KnowledgeStatus
  confidence      ConfidenceLevel

  createdAt       DateTime @default(now())
}
```

---

# 60. Prisma — Supplier

```prisma
model KnowledgeSupplier {
  id         String @id @default(cuid())

  name       String
  legalName  String?
  ruc        String?

  regionId   String?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

# 61. Prisma — KnowledgeEvent

```prisma
model KnowledgeEvent {
  id              String @id @default(cuid())

  eventType       String
  scope           KnowledgeScope

  companyId       String?
  projectId       String?
  userId          String?

  entityType      String
  entityId        String

  previousValue   Json?
  newValue        Json?

  sourceType      String
  sourceId        String?
  evidenceId      String?

  metadata        Json?

  idempotencyKey  String? @unique

  createdAt       DateTime @default(now())
}
```

---

# 62. Prisma — KnowledgeAssertion

```prisma
model KnowledgeAssertion {
  id          String @id @default(cuid())

  subjectType String
  subjectId   String

  predicate   String
  value       Json

  scope       KnowledgeScope
  status      KnowledgeStatus
  confidence  ConfidenceLevel

  companyId   String?
  projectId   String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

# 63. Índices

Índices mínimos:

```text
CanonicalItem.normalizedName
KnowledgeResource.normalizedName

PriceObservation.resourceId
PriceObservation.regionId
PriceObservation.observedAt
PriceObservation.companyId
PriceObservation.projectId

YieldObservation.canonicalItemId
YieldObservation.regionId
YieldObservation.observedAt

Supplier.ruc

KnowledgeEvent.entityId
KnowledgeEvent.eventType
KnowledgeEvent.createdAt

KnowledgeAssertion.subjectId
KnowledgeAssertion.predicate
```

---

# 64. Seguridad

Regla principal:

```text
Company A
cannot read
Company B
```

Todos los services deben implementar scope enforcement.

No confiar únicamente en filtros del frontend.

---

# 65. Privacidad y uso de datos

V0 debe diferenciar:

```text
PRIVATE
AGGREGATABLE
PUBLIC
```

por fuente o política.

Los datos privados no pueden alimentar Global Knowledge automáticamente.

---

# 66. Audit Log

KnowledgeEvent no reemplaza necesariamente el audit log general.

Diferencia:

```text
Audit Log
= quién cambió qué

Knowledge Event
= qué cambio tiene significado para el sistema de conocimiento
```

Pueden compartir infraestructura pero no deben confundirse conceptualmente.

---

# 67. Anonimización futura

Para agregación Global:

```text
Project observation
   ↓
Eligibility
   ↓
Privacy policy
   ↓
Anonymization
   ↓
Aggregation
   ↓
Global benchmark
```

No implementar promoción automática en V0.

---

# 68. Seeds iniciales

MC Presupuestos ya posee datos que pueden utilizarse como candidatos iniciales.

Estrategia:

```text
Existing Catalog
   ↓
Import as Candidate
   ↓
Normalize
   ↓
Detect Duplicates
   ↓
Review
   ↓
Canonical
```

No marcar automáticamente todo el catálogo existente como conocimiento canónico.

---

# 69. Migración de partidas existentes

Pipeline sugerido:

```text
Existing Item
   ↓
Raw Snapshot
   ↓
Normalize
   ↓
Candidate CanonicalItem
   ↓
Alias Detection
   ↓
Review Queue
   ↓
Confirm
```

---

# 70. Migración de recursos existentes

Mismo proceso.

Debe conservar:

- código original;
- nombre original;
- unidad original;
- categoría;
- source system;
- fecha de importación.

---

# 71. Admin interno V0

Crear una UI mínima interna para:

- revisar partidas candidatas;
- revisar recursos candidatos;
- confirmar aliases;
- ver provenance;
- ver eventos;
- ver observaciones;
- promover assertion;
- deprecar assertion.

No construir todavía un dashboard comercial.

---

# 72. Cola de revisión

Se necesita un `Knowledge Review Queue`.

Tipos:

```text
possible duplicate
canonical candidate
unit conflict
resource conflict
supplier duplicate
knowledge promotion
low confidence observation
```

---

# 73. Conflict Detection

Ejemplo:

```text
CanonicalItem:
Conformación de terraplenes

Observation A:
M3

Observation B:
M2
```

No sobrescribir.

Crear:

```text
KnowledgeConflict
```

o generar review task.

---

# 74. Benchmarks — preparación

V0 no necesita ofrecer benchmarks al usuario.

Pero los datos deben permitir posteriormente:

```text
median
mean
p25
p75
min
max
sample count
region
period
project type
```

---

# 75. Anomaly Engine — preparación

Futuro:

```text
Current value
      ↓
Benchmark
      ↓
Deviation
      ↓
Anomaly
```

Ejemplo:

```text
Rendimiento actual:
X

Rango observado:
Y–Z

Resultado:
possible anomaly
```

Nunca presentar automáticamente como error.

---

# 76. MC Data Perú futuro

MC Knowledge Perú es infraestructura.

MC Data Perú podrá ser producto visible.

Posibles capacidades:

- históricos;
- tendencias;
- benchmarking;
- precios observados;
- rendimientos observados;
- proveedores;
- anomalías;
- comparaciones regionales;
- inteligencia de recursos;
- APIs empresariales.

---

# 77. Métricas V0

## Captura

- KnowledgeEvents por semana;
- eventos por proyecto;
- observaciones de precio;
- observaciones de rendimiento;
- evidencia vinculada;
- sugerencias IA aceptadas;
- sugerencias IA modificadas;
- sugerencias IA rechazadas.

## Calidad

- % observations con provenance;
- % observations confirmadas;
- canonical match rate;
- duplicate rate;
- conflict rate;
- review acceptance rate.

## Reutilización

- knowledge retrieval calls;
- APU candidates reused;
- resource candidates reused;
- canonical items reused.

---

# 78. KPI principal

No medir V0 por cantidad de registros.

Medir:

> **Porcentaje de acciones técnicas relevantes que producen conocimiento estructurado y reutilizable.**

---

# 79. KPI de provenance

Objetivo aspiracional:

```text
100% de observaciones de precios mostradas como conocimiento
deben tener fecha y fuente.
```

Cuando exista proveedor/región, también deben mostrarse.

---

# 80. Acceptance Criteria V0

MC Knowledge Perú V0 estará funcional cuando:

1. se pueden crear CanonicalItems;
2. se pueden crear canonical Resources;
3. existen aliases;
4. se pueden almacenar APU versionados;
5. se pueden registrar PriceObservations;
6. se pueden registrar YieldObservations;
7. se puede vincular Source;
8. se puede vincular Evidence;
9. se registran KnowledgeEvents;
10. scopes funcionan correctamente;
11. Company A no ve Company B;
12. MC Presupuestos genera eventos;
13. MC Revisor genera al menos un tipo de evento;
14. se puede recuperar conocimiento por API interna;
15. los eventos son idempotentes;
16. no existe promoción automática a Global;
17. la UI interna permite revisar candidatos;
18. provenance puede inspeccionarse;
19. el sistema mantiene historial;
20. build, tests y migraciones pasan.

---

# 81. Fase 0 — Architecture Audit

Antes de implementar:

Codex debe inspeccionar:

- Prisma schema;
- modelos de APU;
- modelos de recursos;
- partidas;
- usuarios;
- company;
- project;
- auditoría;
- MC Revisor;
- Khipu;
- importación Excel;
- eventos actuales;
- almacenamiento de archivos.

Entregable:

```text
docs/mc-knowledge-audit.md
```

---

# 82. Fase 1 — Knowledge Foundations

Implementar:

- enums;
- scopes;
- Source;
- Evidence;
- KnowledgeEvent;
- servicio de eventos;
- idempotencia;
- tenant isolation.

---

# 83. Fase 2 — Canonical Entities

Implementar:

- CanonicalItem;
- ItemAlias;
- CanonicalResource;
- ResourceAlias;
- normalización;
- búsqueda exacta;
- candidatos.

---

# 84. Fase 3 — APU Knowledge

Implementar:

- APU knowledge reference;
- versioning;
- APU resources;
- provenance;
- eventos de cambio.

No duplicar modelos actuales innecesariamente.

Si el modelo APU existente es sólido, crear una capa knowledge que lo referencie.

---

# 85. Fase 4 — Price & Yield Observations

Implementar:

- PriceObservation;
- YieldObservation;
- Region;
- Supplier;
- Source;
- Evidence.

---

# 86. Fase 5 — MC Presupuestos Event Integration

Emitir eventos desde:

- APU editor;
- resource editor;
- price changes;
- yield changes;
- imports;
- item confirmations.

---

# 87. Fase 6 — MC Revisor Integration

Primeros eventos:

- review confirmed;
- review rejected;
- unit correction;
- item linkage;
- evidence confirmed.

---

# 88. Fase 7 — Knowledge Retrieval

Implementar servicios internos.

Primera integración:

```text
MC Revisor / Khipu
   ↓
find similar items
   ↓
get APU candidates
```

---

# 89. Fase 8 — Admin Review

Crear interfaz interna:

```text
/admin/knowledge
```

Secciones:

- Partidas;
- Recursos;
- Observaciones;
- Eventos;
- Review Queue;
- Conflicts.

---

# 90. Fase 9 — Semantic Search

Solo después de tener datos estructurados.

Agregar:

- embeddings;
- pgvector;
- candidate ranking;
- semantic search.

---

# 91. Fase 10 — Benchmarks

Después de acumular datos suficientes.

Agregar:

- aggregation engine;
- mediana;
- percentiles;
- temporal buckets;
- regional filters.

---

# 92. Fase 11 — Anomaly Detection

Agregar reglas determinísticas primero.

Ejemplo:

```text
value outside P10–P90
```

pero presentar como:

```text
Possible anomaly
```

no como error definitivo.

---

# 93. Orden recomendado de implementación

```text
Audit
  ↓
KnowledgeEvent
  ↓
Scopes + Provenance
  ↓
Canonical Items
  ↓
Canonical Resources
  ↓
APU Versioning
  ↓
Price Observations
  ↓
Yield Observations
  ↓
MC Presupuestos Integration
  ↓
MC Revisor Integration
  ↓
Retrieval
  ↓
Khipu
  ↓
Benchmark
  ↓
MC Data Perú
```

---

# 94. Riesgos

## Contaminación global

**Riesgo:** datos privados se convierten en conocimiento global.

**Mitigación:** promoción explícita y políticas de scope.

---

## Canonicalización incorrecta

**Riesgo:** dos partidas diferentes se fusionan.

**Mitigación:** candidatos + revisión humana.

---

## Precio sin contexto

**Riesgo:** mostrar un precio como universal.

**Mitigación:** Observation model + provenance.

---

## Rendimiento engañoso

**Riesgo:** interpretar rendimiento de un proyecto como estándar nacional.

**Mitigación:** región, proyecto, fecha y contexto.

---

## Eventos excesivos

**Riesgo:** registrar demasiado ruido.

**Mitigación:** domain events relevantes.

---

## Arquitectura duplicada

**Riesgo:** duplicar APU y recursos existentes.

**Mitigación:** audit primero; referenciar modelos actuales siempre que sea posible.

---

## Scope leaks

**Riesgo:** fuga de datos B2B.

**Mitigación:** tenant filtering en services y tests obligatorios.

---

# 95. Decisiones arquitectónicas

## ADR-KNOW-001

**Decisión:** almacenar observaciones, no solamente valores finales.

---

## ADR-KNOW-002

**Decisión:** KnowledgeEvent separado de KnowledgeAssertion.

---

## ADR-KNOW-003

**Decisión:** PostgreSQL como fuente principal.

---

## ADR-KNOW-004

**Decisión:** embeddings como complemento.

---

## ADR-KNOW-005

**Decisión:** no promoción automática a Global.

---

## ADR-KNOW-006

**Decisión:** human review para canonicalización sensible.

---

## ADR-KNOW-007

**Decisión:** no fine-tuning automático en V0.

---

## ADR-KNOW-008

**Decisión:** Khipu consume Knowledge Retrieval.

---

# 96. Testing

## Unit

- normalization;
- scope;
- event validation;
- idempotency;
- confidence enum;
- alias resolution.

## Integration

- MC Presupuestos → Event;
- MC Revisor → Event;
- Event → Observation;
- Observation → Retrieval.

## Security

- cross-company isolation;
- unauthorized project access;
- evidence permissions.

## Migration

- seed existing items;
- seed resources;
- rollback.

---

# 97. Observability

Logs:

```text
knowledge.event.received
knowledge.event.processed
knowledge.event.failed

knowledge.entity.candidate
knowledge.entity.confirmed

knowledge.observation.created

knowledge.assertion.created
knowledge.assertion.promoted

knowledge.retrieval.request
knowledge.retrieval.result
```

---

# 98. Feature Flags

Recomendado:

```text
knowledge_events_v0

knowledge_canonical_items

knowledge_price_observations

knowledge_revisor_events

knowledge_khipu_retrieval
```

Permitir activación gradual.

---

# 99. Rollout

## Etapa 1

Entorno local.

## Etapa 2

Datos test.

## Etapa 3

Proyectos propios internos.

## Etapa 4

Design partners seleccionados.

## Etapa 5

Usuarios Pro.

## Etapa 6

Empresas.

---

# 100. Definition of Done

MC Knowledge Perú V0 se considera completado cuando:

- el modelo base existe;
- las migraciones son estables;
- MC Presupuestos produce KnowledgeEvents;
- MC Revisor produce eventos;
- se almacenan PriceObservations;
- se almacenan YieldObservations;
- existe provenance;
- scopes funcionan;
- no hay cross-tenant leaks;
- canonicalización funciona mediante candidatos;
- existe UI interna;
- retrieval básico funciona;
- no se han duplicado innecesariamente modelos de dominio existentes;
- tests críticos pasan;
- documentación técnica está actualizada.

---

# 101. Evolución futura

```text
MC KNOWLEDGE V0
     │
     ▼
Structured Events
     │
     ▼
Canonical Knowledge
     │
     ▼
Historical Knowledge
     │
     ▼
Benchmarks
     │
     ▼
Anomaly Detection
     │
     ▼
Predictive Intelligence
     │
     ▼
MC DATA PERÚ
```

---

# 102. Visión a largo plazo

MC Knowledge Perú debe convertirse progresivamente en la memoria técnica y económica de Mercado y Construcción.

No debe limitarse a responder:

> ¿Cuánto cuesta este recurso?

Debe poder responder:

> ¿Qué observaciones existen?

> ¿En qué región?

> ¿De qué fechas?

> ¿Qué proveedores aparecen?

> ¿Qué fuentes sustentan los valores?

> ¿Qué rangos se observan?

> ¿Qué APU utiliza normalmente esta empresa?

> ¿Qué rendimiento fue utilizado en proyectos similares?

> ¿Qué cambió el ingeniero después de una sugerencia de Khipu?

> ¿Qué dato contradice las especificaciones del expediente?

> ¿Qué valor parece anómalo frente al histórico?

La ventaja competitiva no será únicamente la IA.

Será:

> **IA + conocimiento estructurado + motor determinístico + trazabilidad + contexto peruano.**

---

# 103. Prompt de implementación para Codex

Antes de modificar código, realiza una auditoría completa del repositorio de MC Presupuestos y documenta en `docs/mc-knowledge-audit.md`:

1. modelos Prisma existentes;
2. modelo de Company, Project y User;
3. modelos de partidas;
4. modelos de recursos;
5. modelos de APU;
6. historial/versionado existente;
7. eventos existentes;
8. infraestructura de auditoría;
9. MC Revisor;
10. Khipu;
11. importadores;
12. almacenamiento de archivos;
13. APIs y services relevantes.

No dupliques modelos existentes sin necesidad.

Después de la auditoría:

1. propone un mapping entre modelos actuales y MC Knowledge;
2. identifica qué modelos pueden reutilizarse;
3. identifica cuáles deben agregarse;
4. identifica migraciones necesarias;
5. identifica riesgos de tenancy;
6. prepara un plan de implementación por fases.

Implementa primero:

```text
KnowledgeScope
Source
Evidence
KnowledgeEvent
idempotency
tenant isolation
```

Después:

```text
CanonicalItem
CanonicalResource
aliases
normalization
```

Después:

```text
PriceObservation
YieldObservation
Region
Supplier
```

Luego integra progresivamente MC Presupuestos y MC Revisor.

No implementes benchmarks, ML, fine-tuning, MC Data UI ni integraciones externas hasta completar y validar el core.

Cada fase debe incluir:

- schema;
- migration;
- service;
- validation;
- tests;
- logging;
- documentación.

Antes de finalizar:

- ejecutar migraciones;
- ejecutar tests;
- ejecutar TypeScript;
- ejecutar lint;
- ejecutar build;
- revisar tenant isolation;
- documentar deuda técnica.

---

# 104. Conclusión

MC Knowledge Perú debe comenzar como infraestructura invisible pero estratégica.

MC Presupuestos aporta eventos económicos y técnicos.

MC Revisor aporta relaciones documentales, inconsistencias y correcciones.

Khipu consume conocimiento estructurado para producir mejores sugerencias.

La secuencia debe ser:

```text
uso real
   ↓
eventos
   ↓
observaciones
   ↓
evidencia
   ↓
validación
   ↓
conocimiento
   ↓
retrieval
   ↓
inteligencia
```

No se debe intentar crear una base perfecta antes de acumular uso.

La base se construirá orgánicamente a medida que los profesionales utilicen el ecosistema Mercado y Construcción.

---

**Fin del documento**
