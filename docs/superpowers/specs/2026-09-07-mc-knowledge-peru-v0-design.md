# MC Knowledge Perú V0 — Especificación de diseño

## Objetivo

Crear una capa interna de conocimiento estructurado para Perú que registre observaciones técnicas y económicas con contexto, provenance, scope, confianza, versionado e historial, sin convertir automáticamente datos privados en conocimiento global.

## Alcance aprobado

Incluye fundaciones de Knowledge, entidades canónicas de partidas y recursos, aliases y normalización, snapshots versionados de APU, observaciones de precios y rendimientos, regiones, proveedores, retrieval interno básico, integración de eventos con Presupuestos/Revisor y revisión administrativa.

Quedan fuera benchmarks públicos, embeddings/pgvector, scraping, SUNAT completa, marketplace, compras, BIM, S10 automático, ML, fine-tuning, pricing predictivo y API comercial.

## Arquitectura

El dominio se divide en servicios puros de normalización/validación y servicios de persistencia Prisma. Los modelos operativos existentes (`BudgetItem`, `Resource`, `Apu`, documentos y Revisor) se conservan; Knowledge los referencia mediante `sourceId`, `entityId` y snapshots, sin duplicar datos de trabajo.

La frontera de tenancy se aplica en cada servicio y ruta: `GLOBAL` es legible por todos; `COMPANY` exige `companyId`; `PROJECT` exige `companyId` y `projectId`; `USER` exige `userId`. Un dato de `COMPANY` o `PROJECT` nunca se promociona automáticamente a `GLOBAL`.

## Contratos principales

```ts
type KnowledgeScope = "GLOBAL" | "COMPANY" | "PROJECT" | "USER";
type KnowledgeStatus = "OBSERVED" | "CONFIRMED" | "VERIFIED" | "CANONICAL" | "DEPRECATED" | "REJECTED";
type KnowledgeConfidence = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

interface KnowledgeEventInput {
  eventType: string;
  scope: KnowledgeScope;
  companyId?: string;
  projectId?: string;
  userId?: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  sourceType: string;
  sourceId?: string;
  evidenceId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}
```

Los eventos son hechos auditables; las assertions son afirmaciones derivadas. La creación de una observación no implica promoción ni canonicalización.

## Persistencia

Se agregarán modelos Prisma específicos con prefijo conceptual `Knowledge`: `KnowledgeSource`, `KnowledgeEvidence`, `KnowledgeEvent`, `CanonicalItem`, `CanonicalItemAlias`, `CanonicalResource`, `CanonicalResourceAlias`, `KnowledgeApu`, `KnowledgeApuVersion`, `KnowledgeApuResource`, `PriceObservation`, `YieldObservation`, `KnowledgeRegion`, `KnowledgeSupplier`, `KnowledgeAssertion`.

Todos los valores monetarios y rendimientos serán `Decimal` PostgreSQL. La normalización será determinística, los coeficientes mantendrán precisión de tres decimales cuando corresponda y no se harán cálculos financieros con `number`.

## Flujos

1. Presupuesto/Revisor/importador produce evento con scope y provenance.
2. Servicio valida payload, tenancy e idempotency key.
3. Servicio persiste evento una sola vez.
4. Un procesador explícito puede convertir el evento en observación o candidato.
5. Retrieval devuelve resultados respetando precedencia `PROJECT → COMPANY → GLOBAL`, sin filtrar datos de otro tenant.
6. Promoción requiere una acción explícita y política autorizada; nunca ocurre por inserción.

## Seguridad y errores

Se rechazan scopes incompletos, referencias cruzadas de otra empresa/proyecto, eventos duplicados con payload distinto, provenance inválida y valores no positivos cuando el tipo lo exige. Las rutas responderán `400` para input inválido, `401/403` para autorización y `404` cuando un recurso no sea visible en el scope solicitado.

## Testing y observabilidad

Cada servicio tendrá pruebas unitarias; las rutas tendrán pruebas de aislamiento. Se cubrirá idempotencia, normalización, aliases, scopes, provenance, observaciones y retrieval. Se emitirán logs estructurados `knowledge.event.received`, `knowledge.event.processed`, `knowledge.event.failed`, `knowledge.observation.created` y `knowledge.retrieval.request/result`.

## Criterios de aceptación

- Se crean y consultan entidades canónicas y aliases.
- Se registran eventos idempotentes con provenance.
- Se registran observaciones de precio y rendimiento con scope.
- Se conserva historial de APU y cambios relevantes.
- Company A no puede leer datos privados de Company B.
- Revisor y Presupuestos pueden emitir eventos sin mutar automáticamente datos operativos.
- Existe retrieval estructurado interno.
- Migración, tests, TypeScript, lint y build pasan.

