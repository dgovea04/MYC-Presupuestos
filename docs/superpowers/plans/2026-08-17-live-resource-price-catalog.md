# Actualización vía API del catálogo global de insumos — Plan de implementación

> **Para agentes de implementación:** usar `superpowers:executing-plans` o `superpowers:subagent-driven-development` cuando se ejecute este plan. Las tareas usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Permitir consultas y actualizaciones controladas de precios del catálogo global de insumos desde un servicio API, con preview, aprobación, auditoría, cache consistente y sin alterar precios históricos de presupuestos o APUs.

**Especificación:** `docs/superpowers/specs/2026-08-17-live-resource-price-catalog-design.md`

**Arquitectura:** Mantener `Resource` como catálogo canónico. Crear un dominio `lib/resource-pricing` con contratos tipados, proveedor API desacoplado, normalización, matching determinista, cálculo decimal-safe y aplicación transaccional. Exponer requests internas por route handlers, usar SSE con polling de respaldo para progreso y ejecutar sincronizaciones programadas mediante el patrón de cron protegido ya existente.

**Stack:** Next.js App Router 16, TypeScript strict, Prisma 7, PostgreSQL, Zod 4, `decimal.js`, Vitest, React Testing Library, cache tags de Next.js y SSE.

## Restricciones globales

- No usar `any`.
- No cambiar fórmulas financieras ni recalcular presupuestos/APUs automáticamente.
- Solo los `Resource` con `companyId = null` son actualizables por este flujo.
- Nunca usar un `companyId` enviado por el navegador como autoridad de destino global.
- Todos los montos se procesan con `decimal.js` y se persisten en `Decimal(18,4)`.
- Las APIs serializan precios como strings.
- Las operaciones externas deben tener timeout, rate limit, idempotencia y logs sin secretos.
- El proveedor principal, sus credenciales, endpoints, versión, TTL, mappings y políticas solo pueden ser administrados por MC Presupuestos mediante APIs administrativas protegidas.
- Los usuarios pueden crear requests, pero nunca elegir el proveedor ni enviar `provider`, `baseUrl`, `apiKey` o endpoint externo.
- `MC Presupuestos Price API Provider` (`mc-presupuestos-price-api`) debe ser tratado como un proveedor de primera parte, con contrato versionado y ciclo de vida propio.
- No agregar un proveedor externo productivo hasta cerrar contrato, credenciales, cobertura, límites y autorización comercial.
- No agregar una dependencia realtime si SSE + polling defensivo cubren la V1.
- Reutilizar `GLOBAL_RESOURCES_CACHE_TAG`, `RESOURCES_BY_USER_CACHE_TAG`, `clearResourcesProcessCache()` y los patrones existentes de `lib/data/resources.ts`.

## Estructura de archivos

### Crear

- `types/resource-pricing.ts`
- `lib/validations/resource-pricing.ts`
- `lib/validations/resource-pricing.test.ts`
- `lib/resource-pricing/types.ts`
- `lib/resource-pricing/provider.ts`
- `lib/resource-pricing/provider-registry.ts`
- `lib/resource-pricing/admin-config.ts`
- `lib/resource-pricing/admin-config.test.ts`
- `lib/resource-pricing/normalization.ts`
- `lib/resource-pricing/normalization.test.ts`
- `lib/resource-pricing/matching.ts`
- `lib/resource-pricing/matching.test.ts`
- `lib/resource-pricing/requests.ts`
- `lib/resource-pricing/requests.test.ts`
- `lib/resource-pricing/application.ts`
- `lib/resource-pricing/application.test.ts`
- `lib/resource-pricing/events.ts`
- `lib/resource-pricing/serialization.ts`
- `lib/resource-pricing/authorization.ts`
- `app/api/resources/price-updates/route.ts`
- `app/api/resources/price-updates/route.test.ts`
- `app/api/resources/price-updates/[id]/route.ts`
- `app/api/resources/price-updates/[id]/route.test.ts`
- `app/api/resources/price-updates/[id]/items/route.ts`
- `app/api/resources/price-updates/[id]/items/route.test.ts`
- `app/api/resources/price-updates/[id]/apply/route.ts`
- `app/api/resources/price-updates/[id]/apply/route.test.ts`
- `app/api/resources/price-updates/[id]/reject/route.ts`
- `app/api/resources/price-updates/[id]/stream/route.ts`
- `app/api/resources/[id]/price/route.ts`
- `app/api/admin/resource-price-provider-config/route.ts`
- `app/api/admin/resource-price-provider-config/route.test.ts`
- `app/api/admin/resource-price-providers/route.ts`
- `app/api/admin/resource-price-providers/[provider]/test/route.ts`
- `app/api/cron/sync-resource-prices/route.ts`
- `app/api/cron/sync-resource-prices/route.test.ts`
- `lib/data/resource-price-history.ts`
- `components/resources/resource-price-sync-panel.tsx`
- `components/resources/resource-price-preview-sheet.tsx`
- `components/resources/resource-price-status.tsx`
- `hooks/use-resource-price-update-stream.ts`
- `components/resources/resource-price-sync-panel.test.tsx`
- `components/resources/resource-price-preview-sheet.test.tsx`
- `docs/resource-price-provider-operations.md`
- `docs/mc-presupuestos-price-api-provider.md`

### Modificar

- `prisma/schema.prisma`
- `lib/data/resources.ts`
- `app/resources/page.tsx`
- `components/resources/resources-page-content.tsx`
- `components/resources/resources-table.tsx`
- `vercel.json`
- `.env.example`
- `README.md` o documentación operativa enlazada desde README
- `lib/workspace/feature-registry.ts` y/o entitlements si se decide proteger la función por plan

### No modificar en la primera fase

- `BudgetItem` ni sus servicios de cálculo.
- `ApuResource` ni editores APU.
- `lib/calculations/**`.
- Exportadores de presupuestos/APUs.
- Flujos de importación que ya materializaron un precio.

---

## Task 0: Definir gobierno administrativo y contrato de `MC Presupuestos Price API Provider`

**Archivos:**

- Crear: `docs/mc-presupuestos-price-api-provider.md`
- Crear: `lib/resource-pricing/admin-config.ts`
- Crear: `lib/resource-pricing/admin-config.test.ts`
- Crear: `app/api/admin/resource-price-provider-config/route.ts`
- Crear: `app/api/admin/resource-price-provider-config/route.test.ts`
- Crear: `app/api/admin/resource-price-providers/route.ts`
- Crear: `app/api/admin/resource-price-providers/[provider]/test/route.ts`
- Modificar: `types/resource-pricing.ts`

- [ ] **Paso 1: Fijar la regla de autoridad**

Documentar y testear que:

- solo un administrador de MC Presupuestos puede activar/suspender/cambiar el proveedor principal;
- solo ese administrador puede modificar credenciales, base URL, versión, TTL, límites, mappings y fallback;
- un usuario normal puede crear una request, pero el servidor resuelve el proveedor activo;
- el body de usuario no acepta `provider`, `baseUrl`, `apiKey` ni endpoint externo;
- aplicar cambios a `Resource` global requiere permiso de sistema independiente del workspace.

- [ ] **Paso 2: Definir configuración global segura**

Crear `ResourcePriceProviderConfig` o una capa equivalente sobre Secret Store con:

- proveedor activo;
- estado (`DISABLED`, `HEALTHY`, `DEGRADED`, `SUSPENDED`);
- versión de API;
- referencia de credencial, nunca secreto plano;
- timeout, batch size, TTL y fallback;
- actor y timestamp del último cambio.

- [ ] **Paso 3: Definir el contrato de primera parte**

Documentar `mc-presupuestos-price-api` con endpoints iniciales:

- `GET /v1/health`;
- `POST /v1/resource-prices:lookup`;
- `GET /v1/catalog/resources`;
- `GET /v1/catalog/versions/[version]`.

El contrato debe incluir `price`, `currency`, `unit`, `observedAt`, `sourceVersion`, paginación, límites de lote, errores tipados y autenticación servicio-a-servicio.

- [ ] **Paso 4: Tests de autorización administrativa**

Cubrir:

- usuario de workspace recibe `403` al leer/escribir configuración;
- administrador MC puede ejecutar health check y cambiar estado;
- credenciales nunca aparecen en la respuesta;
- request de usuario usa el proveedor configurado aunque intente enviar otro;
- proveedor `disabled` bloquea la sincronización productiva sin romper el catálogo manual.

- [ ] **Paso 5: Ejecutar tests**

Run:

```bash
npm run test -- lib/resource-pricing/admin-config.test.ts app/api/admin/resource-price-provider-config/route.test.ts
```

Expected:

- PASS con control administrativo centralizado.

---

## Task 1: Congelar contratos, permisos y comportamiento decimal

**Archivos:**

- Crear: `types/resource-pricing.ts`
- Crear: `lib/validations/resource-pricing.ts`
- Crear: `lib/validations/resource-pricing.test.ts`
- Crear: `lib/resource-pricing/types.ts`
- Crear: `lib/resource-pricing/serialization.ts`
- Crear: `lib/resource-pricing/authorization.ts`

- [ ] **Paso 1: Escribir tests de validación antes de implementar**

Cubrir:

- request para un subconjunto de ids globales;
- rechazo de lote vacío o mayor al límite;
- proveedor omitido del payload de usuario y resuelto por configuración global;
- proveedor desconocido o no autorizado rechazado internamente;
- `mode` permitido;
- `idempotencyKey` con longitud y caracteres válidos;
- aplicación que exige items conocidos;
- rechazo de `companyId` como destino de aplicación;
- precios recibidos como strings decimales válidos;
- rechazo de `NaN`, infinito, negativo y moneda/unidad vacías.

Ejemplo de contrato:

```ts
expect(resourcePriceUpdateRequestSchema.parse({
  resourceIds: ["resource-1"],
  mode: "ON_DEMAND",
})).toMatchObject({ mode: "ON_DEMAND" });
```

- [ ] **Paso 2: Definir tipos compartidos**

Crear tipos para:

- `ResourcePriceProviderName`;
- `ResourcePriceRequestMode`;
- `ResourcePriceRequestStatus`;
- `ResourcePriceUpdateItemStatus`;
- `ResourcePriceQuote`;
- `ResourcePricePreviewItem`;
- `ResourcePriceRequestSummary`;
- `ResourcePriceStreamEvent`.

Los campos `price`, `oldPrice`, `newPrice`, `delta` y similares deben ser `string` en los contratos externos.

- [ ] **Paso 3: Implementar autorización separada**

Crear helpers:

```ts
export async function assertCanRequestResourcePriceUpdate(userId: string): Promise<void> {}
export async function assertCanApplyGlobalResourcePriceUpdate(userId: string): Promise<void> {}
export async function assertGlobalResourceIds(resourceIds: string[]): Promise<void> {}
```

`assertGlobalResourceIds` debe verificar `companyId IS NULL`. No reutilizar la autorización de recursos de empresa para otorgar permiso de aplicación global.

Agregar además:

```ts
export async function assertCanManageResourcePriceProvider(userId: string): Promise<void> {}
export async function resolvePrimaryResourcePriceProvider(): Promise<ResourcePriceProvider> {}
```

El primer helper valida administrador de MC Presupuestos; el segundo solo lee la configuración global y falla de forma controlada si el proveedor está `disabled` o `suspended`.

- [ ] **Paso 4: Implementar serialización decimal-safe**

Crear helpers para:

- serializar Prisma Decimal a string;
- comparar precios usando `Decimal`;
- calcular diferencia absoluta y porcentual sin `Number`;
- normalizar escala solo para comparación/persistencia, sin redondear prematuramente.

- [ ] **Paso 5: Ejecutar tests focalizados**

Run:

```bash
npm run test -- lib/validations/resource-pricing.test.ts
```

Expected:

- PASS con contratos, permisos y precisión base.

---

## Task 2: Agregar persistencia de bindings, snapshots, requests e items

**Archivos:**

- Modificar: `prisma/schema.prisma`
- Crear: migración Prisma generada por el equipo al ejecutar el flujo de migración
- Modificar: `prisma/seed.ts` solo si se necesita un provider fake de desarrollo

- [ ] **Paso 1: Agregar enums y modelos Prisma**

Agregar enums equivalentes a:

```prisma
enum ResourcePriceRequestMode {
  ON_DEMAND
  SCHEDULED
  WEBHOOK
}

enum ResourcePriceRequestStatus {
  QUEUED
  RUNNING
  PREVIEW_READY
  APPLIED
  PARTIALLY_APPLIED
  REJECTED
  FAILED
  CANCELED
}

enum ResourcePriceUpdateItemStatus {
  MATCHED
  UPDATED
  UNCHANGED
  UNMATCHED
  UNIT_MISMATCH
  CURRENCY_MISMATCH
  INVALID_PRICE
  STALE
  CONFLICT
  APPLIED
  REJECTED
  ERROR
}
```

Crear `ResourcePriceBinding`, `ResourcePriceSnapshot`, `ResourcePriceUpdateRequest` y `ResourcePriceUpdateItem` según la especificación.

- [ ] **Paso 2: Agregar índices y restricciones**

Requerir índices por:

- `resourceId`;
- `provider + externalResourceId`;
- `requestId + status`;
- `createdAt desc`;
- `observedAt desc`.

Agregar unicidad para `idempotencyKey` dentro del scope definido y para bindings activos por proveedor/identificador externo.

- [ ] **Paso 3: Extender `Resource` sin cambiar `unitPrice`**

Agregar solo metadatos de sincronización:

- `priceUpdatedAt`;
- `priceObservedAt`;
- `priceSource`;
- `priceSyncStatus`.

Verificar que `unitPrice` conserve `Decimal(18,4)`.

- [ ] **Paso 4: Definir relaciones de borrado y retención**

- Un request no debe borrar snapshots históricos por cascada accidental.
- La eliminación de un `Resource` global debe archivar o bloquear sus bindings según uso.
- Los items deben permanecer para auditoría aun si la aplicación termina en error.

- [ ] **Paso 5: Generar y revisar migración**

Run, solo con la base local configurada:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Revisar que la migración no modifique `BudgetItem`, `ApuResource` ni tablas de fórmulas.

- [ ] **Paso 6: Crear fixtures de test sin proveedor real**

Agregar factories/fixtures para:

- recurso global;
- recurso de empresa;
- binding;
- request con preview;
- snapshot aplicado;
- conflicto por `updatedAt`.

- [ ] **Paso 7: Ejecutar tests de schema/serialización**

Run:

```bash
npm run test -- lib/resource-pricing
```

Expected:

- PASS sin llamadas a un proveedor externo.

---

## Task 3: Implementar registry administrado y normalización

**Archivos:**

- Crear: `lib/resource-pricing/provider.ts`
- Crear: `lib/resource-pricing/provider-registry.ts`
- Crear: `lib/resource-pricing/normalization.ts`
- Crear: `lib/resource-pricing/normalization.test.ts`
- Modificar: `.env.example`

- [ ] **Paso 1: Crear interfaz de proveedor**

Implementar el contrato:

```ts
export interface ResourcePriceProvider {
  readonly name: string;
  lookup(input: ResourcePriceLookup[], signal?: AbortSignal): Promise<ResourcePriceQuote[]>;
  healthCheck(signal?: AbortSignal): Promise<ProviderHealthResult>;
}
```

El dominio debe depender de la interfaz, no de un SDK concreto.

- [ ] **Paso 2: Crear registry explícito**

El registry debe:

- resolver únicamente el proveedor principal configurado por MC Presupuestos;
- rechazar nombres desconocidos o proveedores no aprobados;
- no permitir que el request de usuario seleccione proveedor;
- exponer metadatos de capabilities, TTL y tamaño máximo de lote solo a rutas administrativas;
- no devolver secretos a la UI;
- dejar fallback deshabilitado salvo configuración administrativa explícita.

Registrar dos implementaciones iniciales:

1. `mc-presupuestos-price-api`, proveedor propio de primera parte;
2. `fake`, únicamente para tests/desarrollo.

En desarrollo incluir un `FakeResourcePriceProvider` determinista. No mezclarlo con producción ni permitir que sea activado por usuarios.

- [ ] **Paso 3: Implementar configuración de entorno**

Documentar variables sin valores reales:

```env
RESOURCE_PRICE_PROVIDER=disabled
RESOURCE_PRICE_API_BASE_URL=
RESOURCE_PRICE_API_KEY=
RESOURCE_PRICE_API_VERSION=v1
RESOURCE_PRICE_REQUEST_TIMEOUT_MS=8000
RESOURCE_PRICE_MAX_BATCH_SIZE=50
RESOURCE_PRICE_AUTO_APPLY=false
RESOURCE_PRICE_DEFAULT_TTL_HOURS=24
RESOURCE_PRICE_ALLOW_FALLBACK=false
```

Estas variables son configuración de despliegue administrada por MC Presupuestos. No deben convertirse en campos editables por usuarios de workspace. Para producción se recomienda guardar la credencial en Secret Store y conservar en la base solo una referencia.

El proveedor debe quedar `disabled` si faltan credenciales o configuración. La app no debe fallar al arrancar por la ausencia de un proveedor opcional.

- [ ] **Paso 4: Implementar normalización**

Normalizar:

- descripción y códigos;
- IU/external id;
- unidad canónica;
- moneda ISO;
- precio decimal como string;
- `observedAt` con fecha válida;
- `sourceVersion` del dataset/proveedor;
- hash estable del payload sin secretos.

Para `mc-presupuestos-price-api`, la normalización debe conservar la versión de catálogo propia que originó el precio y permitir reproducir la cotización.

No convertir monedas ni asumir equivalencia entre `kg`, `bol`, `m3`, `hh`, etc.

- [ ] **Paso 5: Testear errores de proveedor**

Cubrir:

- timeout;
- respuesta 429;
- 5xx;
- JSON inválido;
- campos faltantes;
- precio negativo;
- fecha futura o inválida;
- respuesta fuera del tamaño permitido.

- [ ] **Paso 6: Ejecutar tests**

Run:

```bash
npm run test -- lib/resource-pricing/normalization.test.ts lib/resource-pricing/provider.test.ts
```

Expected:

- PASS sin requerir acceso de red.

---

## Task 3A: Crear y validar `MC Presupuestos Price API Provider`

**Archivos/documentos:**

- Crear: `docs/mc-presupuestos-price-api-provider.md`
- Crear: `services/mc-presupuestos-price-api/` o repositorio/servicio equivalente según la decisión de despliegue
- Crear: contratos OpenAPI/versionados del servicio
- Crear: pruebas de contrato proveedor-consumidor
- Modificar: `lib/resource-pricing/provider-registry.ts`

- [ ] **Paso 1: Definir límites del servicio propio**

El servicio propio debe ser responsable de:

- datasets de precios autorizados;
- versiones de catálogo;
- mappings de identificadores externos;
- timestamps de observación;
- health/readiness;
- autenticación servicio-a-servicio;
- rate limiting y auditoría operativa.

La aplicación web sigue siendo responsable de aprobar y persistir el precio vigente de `Resource`.

- [ ] **Paso 2: Publicar contrato versionado V1**

Definir esquemas para:

- lookup individual y por lote;
- respuesta paginada;
- errores `AUTHENTICATION_FAILED`, `RATE_LIMITED`, `INVALID_REQUEST`, `DATA_UNAVAILABLE` y `VERSION_NOT_FOUND`;
- `sourceVersion`, `observedAt`, `currency`, `unit` y `price`.

- [ ] **Paso 3: Implementar autenticación y operación**

Requerir:

- credencial rotatable;
- allowlist de consumidores;
- timeout y límites de lote;
- logs sin precios sensibles innecesarios ni secretos;
- métricas de latencia, disponibilidad y frescura;
- despliegues separados por entorno.

- [ ] **Paso 4: Crear contract tests**

El consumidor web debe verificar contra el schema versionado que:

- una respuesta válida normaliza correctamente;
- una respuesta incompatible se rechaza sin modificar `Resource`;
- una versión inexistente produce error controlado;
- un 429/5xx activa retry/circuit breaker sin aplicar cambios.

- [ ] **Paso 5: Definir rollout propio**

- stub/fake local para desarrollo;
- staging aislado con datasets de prueba;
- health check administrativo;
- canary con preview sin aplicación automática;
- habilitación productiva solo por administrador MC.

---

## Task 4: Implementar matching, requests, preview y cálculo de diferencias

**Archivos:**

- Crear: `lib/resource-pricing/matching.ts`
- Crear: `lib/resource-pricing/matching.test.ts`
- Crear: `lib/resource-pricing/requests.ts`
- Crear: `lib/resource-pricing/requests.test.ts`
- Crear: `lib/data/resource-price-history.ts`

- [ ] **Paso 1: Implementar matching determinista**

Orden obligatorio:

1. binding activo por proveedor/external id;
2. IU/código normalizado;
3. clave exacta de descripción/categoría/unidad;
4. candidato manual no aplicable automáticamente.

Retornar un resultado explícito con `resourceId`, `status`, `confidence`, `reason` y evidencia del match.

- [ ] **Paso 2: Escribir tests de aislamiento**

Cubrir:

- match exacto global;
- mismo código en recurso de empresa: nunca elegirlo;
- dos candidatos ambiguos: `UNMATCHED`;
- unidad distinta: `UNIT_MISMATCH`;
- moneda distinta: `CURRENCY_MISMATCH`;
- proveedor sin external id: no crear binding automático salvo regla explícita.

- [ ] **Paso 3: Crear `createResourcePriceUpdateRequest`**

El servicio debe:

- validar actor y lote;
- deduplicar por idempotency key;
- capturar el conjunto de recursos globales al inicio;
- crear estado `QUEUED`;
- no mutar `Resource.unitPrice`.

- [ ] **Paso 4: Implementar ejecución de request**

El worker/servicio debe:

- pasar por el registry;
- consultar el proveedor en lotes;
- persistir snapshots normalizados;
- generar items de preview;
- calcular `oldPrice`, `newPrice`, `delta` y porcentaje con `Decimal`;
- marcar `UNCHANGED` cuando la comparación decimal sea equivalente;
- publicar eventos de progreso.

- [ ] **Paso 5: Implementar lectura paginada de preview e historial**

Crear servicios para:

- resumen de request;
- items filtrados por estado;
- último snapshot por recurso;
- historial de cambios de precio;
- estado de frescura del catálogo.

Todos deben filtrar por el catálogo global y nunca mezclar recursos de empresa en una aplicación.

- [ ] **Paso 6: Ejecutar tests de dominio**

Run:

```bash
npm run test -- lib/resource-pricing/matching.test.ts lib/resource-pricing/requests.test.ts
```

Expected:

- PASS con preview reproducible y decimal-safe.

---

## Task 5: Implementar aplicación transaccional y auditoría

**Archivos:**

- Crear: `lib/resource-pricing/application.ts`
- Crear: `lib/resource-pricing/application.test.ts`
- Modificar: `lib/data/resources.ts` solo para reutilizar la invalidación si fuera necesario

- [ ] **Paso 1: Escribir tests RED de aplicación**

Cubrir:

- actor sin permiso recibe rechazo;
- item que apunta a recurso de empresa nunca se aplica;
- item `UNCHANGED` no genera escritura innecesaria;
- item con moneda/unidad incompatible no se aplica;
- aplicación actualiza solo `Resource.unitPrice` y metadatos de fuente;
- `BudgetItem` y `ApuResource` permanecen intactos;
- conflicto de `updatedAt` no sobrescribe edición manual;
- aplicación repetida es idempotente;
- precio anterior y nuevo quedan en historial.

- [ ] **Paso 2: Implementar `applyResourcePriceUpdate`**

Firma sugerida:

```ts
export async function applyResourcePriceUpdate(input: {
  requestId: string;
  itemIds?: string[];
  actorUserId: string;
  expectedVersion?: string;
}): Promise<ResourcePriceApplyResult> {}
```

Usar una transacción por item o por lote pequeño. Antes de escribir, volver a consultar:

- `companyId` del recurso;
- `updatedAt`/versión esperada;
- estado del item;
- moneda y unidad;
- permisos del actor.

- [ ] **Paso 3: Registrar historial y auditoría**

Persistir:

- snapshot recibido;
- valor anterior;
- valor aplicado;
- fuente/proveedor;
- request id;
- actor;
- timestamps;
- motivo si hubo rechazo/conflicto.

No guardar headers de autorización ni claves API.

- [ ] **Paso 4: Invalidar cache después de commit**

Después de una aplicación exitosa:

```ts
clearResourcesProcessCache();
revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
revalidateTag(RESOURCES_BY_USER_CACHE_TAG, "max");
revalidatePath("/resources");
```

La invalidación no debe ocurrir antes de que la transacción termine.

- [ ] **Paso 5: Ejecutar tests de aplicación**

Run:

```bash
npm run test -- lib/resource-pricing/application.test.ts
```

Expected:

- PASS con aislamiento global/histórico y cache invalidation mockeada.

---

## Task 6: Exponer APIs internas, SSE y cron

**Archivos:**

- Crear: `app/api/resources/price-updates/route.ts`
- Crear: `app/api/resources/price-updates/route.test.ts`
- Crear: `app/api/resources/price-updates/[id]/route.ts`
- Crear: `app/api/resources/price-updates/[id]/route.test.ts`
- Crear: `app/api/resources/price-updates/[id]/items/route.ts`
- Crear: `app/api/resources/price-updates/[id]/items/route.test.ts`
- Crear: `app/api/resources/price-updates/[id]/apply/route.ts`
- Crear: `app/api/resources/price-updates/[id]/apply/route.test.ts`
- Crear: `app/api/resources/price-updates/[id]/reject/route.ts`
- Crear: `app/api/resources/price-updates/[id]/stream/route.ts`
- Crear: `app/api/resources/[id]/price/route.ts`
- Crear: `app/api/cron/sync-resource-prices/route.ts`
- Crear: `app/api/cron/sync-resource-prices/route.test.ts`
- Crear: `lib/resource-pricing/events.ts`
- Modificar: `vercel.json`

- [ ] **Paso 1: Implementar POST de request**

`POST /api/resources/price-updates` debe:

- validar sesión;
- validar body con Zod;
- limitar lote;
- resolver global resources en servidor;
- resolver el proveedor principal desde la configuración administrada por MC Presupuestos;
- rechazar cualquier `provider`, `baseUrl`, `apiKey` o endpoint externo enviado por el cliente;
- aplicar rate limit por usuario;
- devolver `201` con request resumido;
- no esperar indefinidamente al proveedor si el proceso será asíncrono.

Respuestas mínimas:

- `401` sin sesión;
- `400` payload inválido;
- `403` sin permiso de solicitud;
- `409` idempotency conflict;
- `202` request encolada o `201` si el preview pequeño fue procesado de forma síncrona.

- [ ] **Paso 2: Implementar lectura de estado e items**

Los endpoints deben devolver contratos serializados y paginación estable. No devolver payloads externos crudos por defecto.

- [ ] **Paso 3: Implementar apply/reject**

`apply` debe:

- requerir rol de sistema autorizado;
- aceptar selección de items;
- validar estado actual y versión;
- retornar conteos aplicados, conflictos y errores;
- invalidar cache solo si hubo cambios.

- [ ] **Paso 4: Implementar SSE con fallback**

Crear broker local encapsulado en `lib/resource-pricing/events.ts`:

- `publishResourcePriceEvent`;
- `subscribeResourcePriceEvents`;
- heartbeat;
- cleanup al abortar.

El stream debe validar acceso al request y no permitir escuchar requests ajenas.

- [ ] **Paso 5: Implementar cron**

`GET /api/cron/sync-resource-prices` debe:

- validar `Authorization: Bearer <CRON_SECRET>`;
- no aceptar una URL de proveedor desde query params;
- seleccionar recursos globales vencidos según TTL;
- respetar límites de lote;
- crear requests `SCHEDULED`;
- devolver resumen sin secretos;
- ser idempotente para ejecuciones repetidas.

Agregar el cron en `vercel.json` con una frecuencia inicial conservadora, por ejemplo diaria. La frecuencia final depende del proveedor y del costo.

- [ ] **Paso 6: Testear route handlers**

Run:

```bash
npm run test -- app/api/resources/price-updates app/api/resources/[id]/price/route.test.ts app/api/cron/sync-resource-prices/route.test.ts
```

Expected:

- PASS con auth, permisos, idempotencia, cron y fallback de errores.

---

## Task 7: Integrar estado y preview en el catálogo de insumos

**Archivos:**

- Crear: `components/resources/resource-price-status.tsx`
- Crear: `components/resources/resource-price-sync-panel.tsx`
- Crear: `components/resources/resource-price-preview-sheet.tsx`
- Crear: `components/resources/resource-price-sync-panel.test.tsx`
- Crear: `components/resources/resource-price-preview-sheet.test.tsx`
- Crear: `hooks/use-resource-price-update-stream.ts`
- Modificar: `app/resources/page.tsx`
- Modificar: `components/resources/resources-page-content.tsx`
- Modificar: `components/resources/resources-table.tsx`

- [ ] **Paso 1: Extender el contrato de datos de recursos**

Pasar a la UI únicamente:

- `priceUpdatedAt`;
- `priceObservedAt`;
- `priceSource`;
- `priceSyncStatus`;
- permisos efectivos para solicitar/aplicar.

No pasar secretos ni payloads externos crudos.

- [ ] **Paso 2: Crear status de frescura**

Estados visuales:

- actualizado;
- desactualizado;
- pendiente de revisión;
- proveedor no disponible;
- sin fuente configurada.

Usar el lenguaje visual actual del catálogo, responsive y accesible.

- [ ] **Paso 3: Crear panel de solicitud**

El panel debe permitir:

- seleccionar alcance;
- seleccionar recursos vencidos o filas seleccionadas;
- ver el estado/nombre de la fuente principal resuelta, sin selector de proveedor ni credenciales;
- iniciar request;
- mostrar progreso;
- navegar al preview.

El botón no debe mutar precios directamente.

- [ ] **Paso 4: Crear preview con diferencias**

Mostrar por item:

- descripción/código/IU;
- precio vigente;
- precio externo;
- delta;
- moneda/unidad;
- fuente y fecha;
- estado/reason;
- selección para aplicar.

Los campos financieros deben usar el formatter existente y conservar el string decimal como fuente de cálculo.

- [ ] **Paso 5: Conectar SSE y polling**

El hook debe:

- abrir SSE solo mientras el preview esté activo;
- reconectar con backoff corto;
- cambiar a polling cuando SSE falle;
- cancelar al desmontar;
- no borrar la tabla actual durante el progreso.

- [ ] **Paso 6: Evitar affordances incorrectas en recursos de empresa**

La tabla debe diferenciar visualmente recursos globales y de empresa. El control de aplicación global solo aparece para request items globales y permisos autorizados.

- [ ] **Paso 7: Ejecutar tests de UI**

Run:

```bash
npm run test -- components/resources/resource-price-sync-panel.test.tsx components/resources/resource-price-preview-sheet.test.tsx components/resources/resources-table.test.tsx
```

Expected:

- PASS sin romper edición, pegado Excel, creación o eliminación actuales.

---

## Task 8: Observabilidad, operación, documentación y rollout

**Archivos:**

- Crear: `docs/resource-price-provider-operations.md`
- Crear: `docs/mc-presupuestos-price-api-provider.md`
- Modificar: `.env.example`
- Modificar: `README.md`
- Modificar: `docs/cron-jobs.md`
- Modificar: feature registry/entitlements si se habilita por plan
- Crear o modificar tests de deployment readiness si el repo los usa

- [ ] **Paso 1: Documentar operación del proveedor**

Incluir:

- alta y rotación de credenciales por entorno, solo para administradores de MC Presupuestos;
- activación, suspensión y cambio del proveedor principal;
- timeout, rate limit y TTL;
- health check;
- rotación de API key;
- interpretación de estados;
- replay/retry seguro;
- retención de snapshots;
- procedimiento para desactivar proveedor;
- procedimiento de rollback del precio global.

- [ ] **Paso 2: Añadir checklist de seguridad**

Verificar:

- variables ausentes no rompen la app;
- credenciales no aparecen en logs ni respuestas;
- requests de usuarios no pueden apuntar a recursos de empresa;
- apply no está accesible a un usuario sin permiso;
- cron sin secret devuelve `401`;
- rate limiting y circuit breaker funcionan.

- [ ] **Paso 3: Añadir métricas**

Registrar métricas compatibles con la instrumentación existente:

- provider lookup latency;
- request duration;
- matches/unmatched/errors;
- applied/conflicted items;
- cache invalidation;
- provider 429/5xx.

- [ ] **Paso 4: Ejecutar verificación amplia**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Además ejecutar pruebas financieras existentes:

```bash
npm run test -- lib/calculations/budget.test.ts lib/calculations/apu.test.ts lib/calculations/polynomial-formula.test.ts
```

Expected:

- PASS sin cambios en fórmulas ni precios materializados de presupuestos/APUs.

- [ ] **Paso 5: QA de aislamiento**

Crear una prueba de integración o e2e que:

1. cree/identifique un recurso global y uno de empresa;
2. genere preview con ambos ids enviados maliciosamente;
3. confirme que el de empresa se rechaza o queda fuera;
4. aplique el global;
5. confirme que un `BudgetItem`/`ApuResource` relacionado conserva su precio;
6. confirme que el catálogo refresca después de invalidar cache.

- [ ] **Paso 6: Rollout progresivo**

- Release 0: schema, dominio, gobierno administrativo y fake provider deshabilitado.
- Release 1: contrato/stub de `mc-presupuestos-price-api` y pruebas de contrato.
- Release 2: consulta on-demand y preview sin aplicación automática; el proveedor se resuelve centralmente.
- Release 3: aplicación exclusiva del administrador MC de items aprobados y auditoría.
- Release 4: UI completa, SSE/polling y cron diario.
- Release 5: activación productiva de `mc-presupuestos-price-api` después de validar contrato, datasets, costo y cobertura.
- Release 6: reglas de TTL por categoría, bindings administrables y eventual webhook.

- [ ] **Paso 7: Definir feature flag**

Usar una flag explícita, por ejemplo `resource_prices.api_sync`, para esconder UI y endpoints de aplicación mientras el proveedor esté en validación. La flag no reemplaza la autorización del route handler.

---

## Contratos de aceptación

### Funcional

- [ ] El usuario puede crear una solicitud para recursos globales.
- [ ] La consulta produce preview antes de cambiar `Resource.unitPrice`.
- [ ] El actor autorizado puede aplicar solo items seleccionados y compatibles.
- [ ] Se puede ver la fuente, fecha, precio anterior, precio nuevo y estado.
- [ ] La actualización programada crea requests auditables.
- [ ] La UI muestra progreso realtime o polling de respaldo.

### Seguridad

- [ ] Recursos de empresa nunca se actualizan desde el flujo global.
- [ ] El usuario no puede enviar un proveedor o endpoint arbitrario.
- [ ] Solo un administrador de MC Presupuestos puede configurar, activar, suspender o cambiar el proveedor principal.
- [ ] Solo un administrador de MC Presupuestos puede aplicar cambios al catálogo global.
- [ ] El apply requiere permiso separado de la membresía de workspace.
- [ ] Las credenciales de `mc-presupuestos-price-api` usan autenticación servicio-a-servicio y rotación.
- [ ] Cron y health checks están protegidos.
- [ ] Las credenciales no se persisten ni se devuelven al cliente.
- [ ] La aplicación usa idempotencia y control optimista de concurrencia.

### Precisión y consistencia

- [ ] Precios y diferencias usan `decimal.js`.
- [ ] Persistencia mantiene `Decimal(18,4)`.
- [ ] APIs usan strings para montos.
- [ ] `BudgetItem` y `ApuResource` existentes no cambian.
- [ ] No se recalculan presupuestos, APUs, IGV, GG o utilidad.
- [ ] Cache se invalida solo después de una escritura exitosa.

### Calidad

- [ ] Tests unitarios de validación, normalización, matching y aplicación.
- [ ] Tests de route handlers de auth, permisos e idempotencia.
- [ ] Tests UI del panel y preview.
- [ ] Typecheck, lint, suite de tests y build pasan.
- [ ] Documentación operativa y variables de entorno están actualizadas.

## Riesgos y mitigaciones

### Fuente externa inexacta

**Mitigación:** preview obligatorio, binding estable, estado de unidad/moneda, aprobación y rollback auditable.

### Confusión entre precio base e histórico

**Mitigación:** no tocar `BudgetItem`/`ApuResource`, mostrar fuente y fecha, documentar la acción explícita futura de actualizar desde catálogo.

### Sobrescritura de edición manual

**Mitigación:** `expectedVersion`/`updatedAt`, conflicto explícito y no auto-aplicar silencioso.

### Costos y límites del proveedor

**Mitigación:** lotes, TTL, rate limiting, circuit breaker, cache de cotización y cron conservador.

### Gobierno o disponibilidad del proveedor propio

**Mitigación:** configuración `disabled` por defecto, administración exclusiva de MC Presupuestos, fake provider para desarrollo, contrato versionado, health checks, circuit breaker y feature flag; la app sigue operando con catálogo manual.

### Falta de proveedor operativo

**Mitigación:** registry con `disabled`, fake provider para desarrollo y feature flag; la app sigue operando con catálogo manual.

### Realtime frágil en serverless

**Mitigación:** SSE encapsulado, heartbeat, reconexión y polling defensivo; la fuente de verdad sigue siendo PostgreSQL.

## Self-review

### Cobertura de la solicitud

- actualización de precios mediante API: Tasks 3, 3A, 4 y 6;
- gobierno exclusivo del proveedor principal: Tasks 0, 3 y 6;
- creación del proveedor propio `mc-presupuestos-price-api`: Task 3A;
- lista base actualizada: Tasks 2, 5 y 7;
- request del usuario: Tasks 1, 4, 6 y 7;
- actualizaciones controladas: Task 5;
- solo catálogo global: Tasks 1, 2, 4, 5 y QA de aislamiento;
- tiempo real/progreso: Task 6 y Task 7;
- documentación operativa: Task 8.

### Control de alcance

- No se cambia el precio histórico de ningún presupuesto/APU.
- No se reemplaza el modelo `Resource` ni su API CRUD actual.
- No se elige un proveedor externo sin validar contrato y credenciales.
- El proveedor principal no se puede cambiar desde un workspace ni desde el payload del usuario.
- `mc-presupuestos-price-api` se crea como frontera de primera parte, no como URL arbitraria dentro de la app.
- No se introduce una dependencia realtime innecesaria.
- No se permite que un usuario de workspace aplique cambios globales por accidente.

### Decisiones que deben confirmarse antes de codificar el proveedor productivo

- contrato V1 y despliegue de `mc-presupuestos-price-api`;
- datasets/fuentes autorizadas y cobertura de categorías y unidades;
- moneda oficial de respuesta;
- política de credenciales, rotación y allowlist;
- TTL y frecuencia del cron;
- administrador/permiso exacto con capacidad de configuración y aplicación;
- política de retención, rollback y continuidad del servicio propio.
