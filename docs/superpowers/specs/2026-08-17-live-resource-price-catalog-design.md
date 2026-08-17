# Catálogo de precios de insumos con actualización vía API — Especificación de diseño

**Fecha:** 2026-08-17  
**Estado:** Propuesta para implementación  
**Producto:** MC Presupuestos

## Objetivo

Mantener actualizado el precio vigente de la **lista base de insumos del sistema** mediante un servicio API de precios, permitiendo que un usuario solicite una consulta o actualización y que el sistema muestre el resultado con trazabilidad, diferencias y fecha de vigencia.

La solución debe ser segura para el dominio financiero de MC Presupuestos:

- Solo puede cambiar precios del catálogo global de insumos del sistema.
- No puede modificar recursos pertenecientes a una empresa.
- No puede modificar automáticamente `BudgetItem`, `ApuResource`, partidas, presupuestos, APUs, metrados, fórmulas ni reportes existentes.
- Debe conservar el precio utilizado históricamente en cada presupuesto o APU.
- Debe usar precisión decimal segura y registrar quién, cuándo, desde qué proveedor y con qué dato aplicó cada cambio.

## Terminología

- **Catálogo global/base:** registros `Resource` cuyo `companyId` es `null`.
- **Recurso de empresa:** registro `Resource` con `companyId` distinto de `null`.
- **Precio vigente del catálogo:** `Resource.unitPrice` del registro global.
- **Cotización externa:** dato devuelto por un proveedor API; todavía no cambia la base de datos.
- **Preview:** conjunto de diferencias normalizadas entre cotización externa y catálogo global.
- **Aplicación:** operación explícita que persiste cambios aprobados en los `Resource` globales.
- **Request:** solicitud de consulta/sincronización creada por un usuario, un administrador o un scheduler.
- **Proveedor:** adaptador de una API de precios. No debe filtrarse su contrato al resto del dominio.
- **Proveedor principal:** proveedor global configurado y controlado exclusivamente por administradores de MC Presupuestos. Los usuarios no lo seleccionan ni suministran sus credenciales.
- **MC Presupuestos Price API Provider:** proveedor propio de primera parte, identificado internamente como `mc-presupuestos-price-api`, que se diseñará como la fuente de precios operable por MC Presupuestos y consumida mediante el mismo contrato de adaptador.

## Alcance

### Incluido

1. Consulta bajo demanda del precio de uno o varios insumos globales.
2. Solicitud de sincronización del catálogo global completo o de un subconjunto.
3. Adaptador interno para uno o más proveedores API, con un proveedor principal resuelto por configuración global de MC Presupuestos.
4. Diseño y creación progresiva de `MC Presupuestos Price API Provider` (`mc-presupuestos-price-api`) como proveedor propio de primera parte.
5. Administración del proveedor principal, credenciales, mappings, TTL y políticas exclusivamente desde el panel de administración de MC Presupuestos.
4. Normalización de descripción, unidad, moneda, precio y fecha de fuente.
5. Matching por identificador externo estable y, solo como fallback controlado, por IU/código/unidad.
6. Preview con estados `MATCHED`, `UPDATED`, `UNCHANGED`, `UNMATCHED`, `UNIT_MISMATCH`, `CURRENCY_MISMATCH`, `INVALID_PRICE` y `STALE`.
7. Aprobación explícita antes de escribir precios globales.
8. Historial inmutable de precios y auditoría de solicitudes/aplicaciones.
9. Estado de frescura visible en `/resources`.
10. Actualización de cache del catálogo después de una aplicación exitosa.
11. Scheduler protegido con `CRON_SECRET` para sincronizaciones programadas.
12. Stream SSE o polling de estado para que la UI muestre progreso sin recargar toda la página.

### Fuera de alcance

- Actualización automática de precios dentro de presupuestos o APUs existentes.
- Recalculo automático de costos directos, GG, utilidad, IGV o total por cambios del catálogo.
- Edición de recursos de empresa desde el proveedor global.
- Conversión monetaria implícita entre monedas.
- Scraping o uso de una fuente no autorizada por contrato.
- Prometer precios en tiempo real si el proveedor solo entrega cortes diarios o históricos.
- Edición concurrente tipo spreadsheet del catálogo.
- Introducir WebSockets o una plataforma realtime externa sin una necesidad demostrada.

## Estado actual relevante

La implementación actual ya tiene varios puntos de integración útiles:

- `Resource` distingue catálogo global y recursos de empresa mediante `companyId`.
- `Resource.unitPrice` es `Decimal(18,4)` en Prisma.
- `lib/data/resources.ts` combina recursos globales y de empresa para la vista de catálogo.
- El catálogo usa `GLOBAL_RESOURCES_CACHE_TAG` y `RESOURCES_BY_USER_CACHE_TAG`.
- Existen `POST` y `PATCH` en `/api/resources` y operaciones por id en `/api/resources/[id]`.
- La autorización usa membresías de workspace para recursos de empresa.
- Los precios se copian a `ApuResource` y `BudgetItem`; esas copias son datos operativos independientes.
- Ya existe un patrón de cron protegido por `CRON_SECRET` y rutas SSE para otros módulos.
- `decimal.js`, Zod, Prisma, Next.js App Router, Vitest y PostgreSQL ya forman parte del stack.
- El proveedor principal todavía no está definido ni configurado; por eso la V1 debe operar con estado `disabled` hasta que el administrador de MC Presupuestos lo habilite.
- La futura API propia `mc-presupuestos-price-api` debe ser un servicio de primera parte con ciclo de vida, autenticación, versionado y observabilidad controlados por MC Presupuestos.

La solución debe extender estos puntos, no crear un segundo catálogo ni sustituir `lib/data/resources.ts` por una integración externa directa.

## Decisiones de arquitectura

### 0. Gobierno central del proveedor principal

El proveedor principal es una configuración global del sistema, no una preferencia del usuario ni del workspace. Solo un administrador autorizado de MC Presupuestos puede:

- activar, desactivar o cambiar el proveedor principal;
- configurar base URL, versión, credenciales, timeouts, límites y TTL;
- registrar o modificar mappings externos;
- ejecutar health checks administrativos;
- habilitar fallback, si se decide soportarlo;
- aplicar precios al catálogo global;
- revisar y auditar todas las sincronizaciones programadas.

Los usuarios autenticados pueden solicitar una consulta o sincronización, pero el backend resuelve el proveedor principal desde la configuración global. El cliente nunca envía `provider`, `baseUrl`, `apiKey` ni una ruta externa como fuente de verdad.

La autorización de workspace no otorga capacidad de administrar el proveedor ni de modificar el catálogo global. La aplicación de cambios debe validar un permiso de sistema de MC Presupuestos en cada request.

### 1. La fuente de verdad sigue siendo PostgreSQL

El proveedor externo es una fuente de cotizaciones, no una base de datos operativa del producto. El catálogo global conserva el precio que MC Presupuestos ha aceptado como vigente.

Flujo canónico:

```text
Usuario / Cron
    -> API interna de solicitud
    -> Servicio de sincronización
    -> Adaptador de proveedor
    -> Normalización y matching
    -> Preview persistido
    -> Aprobación explícita
    -> Resource global + historial + auditoría
    -> Invalidación de cache
```

Nunca se debe llamar al proveedor desde un componente UI ni escribir directamente desde un route handler sin pasar por el servicio de dominio.

### 2. "Tiempo real" tendrá una semántica explícita

La V1 define tres modos:

- **Consulta inmediata:** el usuario solicita un insumo y recibe la última cotización disponible del proveedor.
- **Sincronización bajo demanda:** el usuario solicita un lote, se genera preview y luego se aplica.
- **Sincronización programada:** el scheduler consulta lotes configurados y deja resultados pendientes de aprobación.

Si el proveedor ofrece webhooks, se podrá agregar un cuarto modo (`PUSH`) detrás del mismo adaptador. No se debe llamar tiempo real a un precio cuya fuente tiene una antigüedad mayor que su `observedAt` y `maxAge` configurados.

El sistema debe mostrar siempre:

- fecha/hora de observación externa;
- fecha/hora de sincronización local;
- estado `FRESH`, `STALE`, `UNKNOWN` o `ERROR`;
- proveedor principal resuelto y fuente;
- moneda y unidad normalizadas.

### 3. El usuario puede solicitar; el proveedor y la aplicación global son de MC Presupuestos

Por seguridad y coherencia multiempresa se establece el siguiente flujo:

| Operación | Usuario autenticado | Administrador de MC Presupuestos |
|---|---:|---:|
| Solicitar consulta/sincronización | Sí | Sí |
| Elegir proveedor | No | Sí |
| Ver preview propio | Sí | Sí |
| Ver estado y fuente resuelta | Sí, sin credenciales | Sí |
| Aplicar cambios al catálogo global | No | Sí |
| Rechazar/cancelar request propia pendiente | Sí | Sí |
| Configurar proveedor, credenciales y reglas | No | Sí |
| Administrar `mc-presupuestos-price-api` | No | Sí |

Los usuarios no pueden enviar un proveedor alternativo para saltarse el proveedor principal. La API interna resuelve siempre la configuración activa en servidor. La aplicación global debe usar un permiso del sistema, no `EDITOR` de una compañía.

### 4. Matching determinista antes de similitud

Orden de resolución recomendado:

1. `ResourcePriceBinding` por `provider` + `externalResourceId`.
2. Código/IU normalizado si el proveedor entrega el mismo identificador regulatorio.
3. Clave normalizada de categoría + descripción + unidad, solo para generar un candidato de preview.
4. Nunca aplicar automáticamente un match fuzzy no confirmado.

Un candidato ambiguo queda `UNMATCHED` o `REVIEW_REQUIRED` y no puede modificar precios.

### 5. No se propagan precios al histórico operativo

Cuando se actualice un `Resource` global:

- `ApuResource.unitPrice` no cambia.
- `BudgetItem.unitPrice` no cambia.
- El presupuesto no se recalcula.
- El usuario puede usar el nuevo precio en una operación futura o mediante un flujo separado y explícito de "actualizar desde catálogo".

El precio del catálogo y el precio histórico deben poder convivir y compararse, pero no se deben confundir.

## Modelo de datos propuesto

### Extensiones de `Resource`

Agregar metadatos operativos mínimos:

- `priceUpdatedAt DateTime?`: última aplicación local aceptada.
- `priceObservedAt DateTime?`: fecha declarada por la fuente externa.
- `priceSource String?`: identificador legible del proveedor/fuente.
- `priceSyncStatus String?`: estado de frescura o error resumido.

No reemplazar `unitPrice`; continúa siendo el precio vigente consumido por el catálogo.

### `ResourcePriceBinding`

Mapea un recurso global con el identificador estable del proveedor:

- `id`
- `resourceId`
- `provider`
- `externalResourceId`
- `externalCode`
- `externalUnit`
- `active`
- `metadata Json?`
- `createdAt`
- `updatedAt`

Restricciones:

- `resourceId` debe apuntar a un `Resource` global.
- Un mismo par `provider + externalResourceId` no puede mapear a dos recursos activos.
- La eliminación de un recurso debe impedir o archivar el binding según las reglas actuales de uso.

### `ResourcePriceSnapshot`

Registro inmutable de una cotización normalizada:

- `id`
- `resourceId?`
- `provider`
- `externalResourceId?`
- `requestId?`
- `price Decimal(18,4)`
- `currency`
- `unit`
- `observedAt`
- `receivedAt`
- `rawHash`
- `rawPayload Json?` o referencia segura al payload
- `status`
- `createdAt`

El payload crudo debe estar sujeto a retención y no debe guardar secretos, tokens ni headers de autenticación.

### `ResourcePriceProviderConfig`

Configuración global administrada únicamente por MC Presupuestos:

- `id`
- `provider` (`mc-presupuestos-price-api` u otro adaptador aprobado)
- `isPrimary`
- `status` (`DISABLED`, `HEALTHY`, `DEGRADED`, `SUSPENDED`)
- `baseUrl` o referencia segura a configuración
- `apiVersion`
- `credentialReference` (referencia, nunca el secreto en texto plano)
- `timeoutMs`
- `maxBatchSize`
- `defaultTtlHours`
- `allowFallback`
- `lastHealthCheckAt`
- `lastHealthStatus`
- `createdAt`
- `updatedAt`

La configuración puede persistirse en una tabla protegida o en Secret Store según la política de despliegue. La UI de usuarios no puede leerla completa.

### `ResourcePriceUpdateRequest`

Representa el proceso completo de consulta/sincronización:

- `id`
- `companyId?` o `requestedById` según el modelo de auditoría; el catálogo objetivo siempre es global.
- `requestedById?`
- `mode` (`ON_DEMAND`, `SCHEDULED`, `WEBHOOK`)
- `provider`
- `status` (`QUEUED`, `RUNNING`, `PREVIEW_READY`, `APPLIED`, `PARTIALLY_APPLIED`, `REJECTED`, `FAILED`, `CANCELED`)
- `resourceCount`
- `matchedCount`
- `changedCount`
- `errorCount`
- `idempotencyKey`
- `startedAt?`
- `completedAt?`
- `createdAt`
- `updatedAt`

### `ResourcePriceUpdateItem`

Detalle auditable de cada candidato:

- `id`
- `requestId`
- `resourceId?`
- `externalResourceId?`
- `status`
- `oldPrice Decimal(18,4)?`
- `newPrice Decimal(18,4)?`
- `oldCurrency?`
- `newCurrency?`
- `oldUnit?`
- `newUnit?`
- `priceDelta Decimal(18,4)?`
- `priceDeltaPercent Decimal(10,4)?` solo como dato de presentación, no como base de cálculo financiero
- `matchConfidence Decimal(5,4)?`
- `reason?`
- `appliedAt?`
- `appliedById?`
- `createdAt`

Los valores financieros se serializan como strings en APIs y snapshots. Los porcentajes se calculan con `decimal.js` y se redondean únicamente para presentación.

## Contrato del proveedor API

Crear una interfaz interna independiente del proveedor concreto. El nombre del proveedor se resuelve en servidor desde `ResourcePriceProviderConfig`; no forma parte del payload de solicitud de un usuario:

### Proveedor propio: `MC Presupuestos Price API Provider`

La creación del proveedor propio se contempla como una capacidad de primera parte y no como una URL arbitraria dentro de la aplicación. Su contrato inicial debe incluir:

- `GET /v1/health` para health check;
- `POST /v1/resource-prices:lookup` para consultas por identificadores externos o claves normalizadas;
- `GET /v1/catalog/resources` para catálogo/mappings autorizados;
- `GET /v1/catalog/versions/[version]` para versionar datasets;
- autenticación servicio-a-servicio con credenciales rotables;
- versionado explícito (`/v1`), límites de lote, timeouts y respuestas paginadas;
- `observedAt`, `sourceVersion`, `currency`, `unit` y `price` en cada cotización;
- logs, métricas, trazas y auditoría bajo control de MC Presupuestos.

La API propia debe tener su propio ciclo de vida de despliegue y no debe depender de una sesión de usuario. El catálogo web consume sus precios mediante el adaptador, mientras el servicio propio conserva la responsabilidad de sus datasets, fuentes y versiones. En la primera entrega se puede implementar un stub/fake local, seguido de un servicio desplegable separado cuando el contrato de datos esté validado.

Crear una interfaz interna independiente del proveedor concreto:

```ts
export type ResourcePriceProviderName = string;

export type ResourcePriceLookup = {
  externalResourceId?: string;
  externalCode?: string;
  description: string;
  category?: string;
  unit: string;
  currency: string;
};

export type ResourcePriceQuote = {
  externalResourceId: string | null;
  externalCode: string | null;
  description: string;
  category: string | null;
  unit: string;
  currency: string;
  price: string;
  observedAt: string;
  sourceLabel: string;
  rawHash: string;
};

export interface ResourcePriceProvider {
  readonly name: ResourcePriceProviderName;
  lookup(input: ResourcePriceLookup[], signal?: AbortSignal): Promise<ResourcePriceQuote[]>;
  healthCheck(signal?: AbortSignal): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
}
```

Reglas del adaptador:

- Validar la respuesta del proveedor con Zod.
- Convertir precios a strings decimales antes de entrar al dominio.
- Rechazar `NaN`, infinitos, negativos no permitidos y unidades vacías.
- No recibir ni retornar API keys desde la UI.
- Aplicar timeout, retry limitado y backoff solo para errores transitorios.
- Respetar rate limits del proveedor.
- Registrar métricas sin guardar secretos ni payloads sensibles.

## API interna propuesta

### Solicitudes

- `POST /api/resources/price-updates`
  - Crea una request para uno o varios recursos globales.
  - Body: `{ resourceIds?, mode?: "ON_DEMAND" | "SCHEDULED", idempotencyKey? }`.
  - El backend resuelve el proveedor principal; el body no acepta `provider`, `baseUrl`, credenciales ni endpoint externo.
  - No acepta `companyId` como destino de escritura.

- `GET /api/resources/price-updates/[id]`
  - Devuelve estado, conteos, timestamps y errores resumidos.

- `GET /api/resources/price-updates/[id]/items`
  - Devuelve preview paginado y filtros por estado.

- `POST /api/resources/price-updates/[id]/apply`
  - Requiere permiso de catalog manager/admin.
  - Body: `{ itemIds?: string[], expectedVersion?: string }`.
  - Aplica solo items `UPDATED` que hayan sido revisados y sigan vigentes.

- `POST /api/resources/price-updates/[id]/reject`
  - Rechaza el preview completo o items seleccionados.

- `GET /api/resources/[id]/price`
  - Devuelve precio vigente, última observación, fuente y estado de frescura.
  - No consulta directamente desde el navegador al proveedor.

### Salud/configuración administrada por MC Presupuestos

- `GET /api/admin/resource-price-providers`
- `POST /api/admin/resource-price-providers/[provider]/test`
- `GET /api/admin/resource-price-sync/health`
- `GET /api/admin/resource-price-provider-config`
- `PUT /api/admin/resource-price-provider-config`
- `POST /api/admin/resource-price-provider-config/rotate-credentials`
- `POST /api/admin/resource-price-provider-config/activate`
- `POST /api/admin/resource-price-provider-config/suspend`

Estas rutas deben quedar protegidas por rol/permisos de sistema de MC Presupuestos, con auditoría administrativa y sin exponer credenciales, URLs sensibles o referencias de secretos al cliente no autorizado.

### Progreso realtime

- `GET /api/resources/price-updates/[id]/stream`

V1 puede usar SSE con eventos:

- `request.started`
- `request.progress`
- `preview.ready`
- `request.failed`
- `request.applied`

Si SSE no está disponible en el entorno, la UI debe degradar a polling de `GET /api/resources/price-updates/[id]`.

## Reglas de aplicación

Antes de aplicar cada item:

1. Verificar que el `Resource` sigue existiendo y `companyId IS NULL`.
2. Verificar que el item no fue aplicado/rechazado.
3. Verificar `expectedVersion` o `updatedAt` para evitar sobrescribir una edición manual posterior.
4. Verificar moneda y unidad compatibles.
5. Verificar precio decimal válido y dentro de límites configurables.
6. Registrar el snapshot y la auditoría en la misma transacción.
7. Actualizar `Resource.unitPrice` y metadatos de fuente.
8. Marcar el item como aplicado.
9. Invalidar cache solo después de completar la transacción.

Si un item falla, el resultado debe ser parcial y explícito; no ocultar errores ni hacer rollback de items independientes ya aplicados, salvo que el usuario solicite modo transaccional de lote.

## Cache y consistencia

Después de aplicar al menos un precio global:

- llamar `clearResourcesProcessCache()`;
- invalidar `GLOBAL_RESOURCES_CACHE_TAG`;
- invalidar `RESOURCES_BY_USER_CACHE_TAG`;
- revalidar `/resources`;
- publicar el evento de actualización para clientes conectados.

La API de lectura debe devolver `updatedAt`, `priceUpdatedAt`, `priceObservedAt` y `priceSyncStatus` para que el usuario entienda si la pantalla está viendo un precio fresco o cacheado.

## Seguridad

- El proveedor principal y toda su configuración son propiedad operativa de MC Presupuestos; ningún usuario de workspace puede elegirlo, reemplazarlo o inyectar un endpoint.
- Secretos del proveedor solo en variables de entorno o Secret Store; nunca en Prisma, request body, logs o cliente.
- `MC Presupuestos Price API Provider` debe usar autenticación servicio-a-servicio, rotación de credenciales, versionado y allowlist de consumidores.
- Las rutas administrativas deben registrar actor, cambio anterior, cambio nuevo y motivo, sin registrar el secreto.
- No habilitar fallback automático sin una configuración explícita del administrador y una política de auditoría.
- Rate limit por usuario para requests bajo demanda.
- Rate limit global y circuit breaker por proveedor.
- SSRF protection: endpoints de proveedor configurados en servidor, sin URL arbitraria enviada por cliente.
- Validar tamaño de lotes para evitar abuso y timeouts.
- Toda aplicación global debe registrar actor, request, proveedor, IP/request id si está disponible y diff.
- No permitir que una membresía de compañía convierta un recurso de empresa en global desde este flujo.
- El endpoint de cron debe validar `CRON_SECRET` con el patrón existente.

## Rendimiento y operación

Objetivos iniciales:

- Consulta individual: respuesta o estado inicial en menos de 2 segundos cuando el proveedor responda.
- Preview de lote: procesamiento por lotes con progreso, sin bloquear una request HTTP extensa.
- UI de catálogo: no consultar el proveedor en cada render.
- Aplicación: transacciones pequeñas por lote y paginación de preview.
- Soportar al menos 1,000 recursos globales sin payloads gigantes.

Métricas mínimas:

- requests por proveedor y estado;
- latencia p50/p95;
- cantidad de matches, no matches y errores;
- antigüedad promedio del precio global;
- porcentaje de items aplicados;
- tasa de respuestas 429/5xx del proveedor;
- tiempo entre `observedAt` y `appliedAt`.

## UX propuesta para `/resources`

Agregar al header o toolbar del catálogo:

- estado general: `Actualizado hace ...`, `Hay resultados pendientes`, `Proveedor no disponible`; el usuario ve el nombre/estado de la fuente resuelta, pero no puede cambiar el proveedor;
- botón `Consultar precios`;
- selector de alcance: seleccionados / recursos vencidos / catálogo completo; no selector de proveedor;
- fecha de última sincronización;
- filtro `Precio desactualizado`;
- columna o detalle de fuente y fecha;
- acceso al preview de una request;
- aplicación visible solo a usuarios con permiso.

En cada fila global:

- precio vigente;
- fuente;
- fecha de observación;
- badge de frescura;
- diferencia propuesta cuando exista preview.

No agregar controles de sincronización a recursos de empresa que sugieran que serán modificados por el servicio global.

## Reglas de precisión financiera

- Prisma mantiene `Decimal(18,4)`.
- El dominio usa `decimal.js` para diferencias, porcentajes, límites y comparaciones.
- Las APIs serializan montos como strings.
- No usar `Number` para decidir si un precio cambió.
- Comparar precios después de normalizar escala, moneda y unidad.
- Un cambio de moneda o unidad no se aplica automáticamente.
- No recalcular presupuesto ni APU en esta funcionalidad.
- Los tests deben cubrir `0`, precios con cuatro decimales, cambios pequeños, valores grandes y redondeo visual.

## Estados y errores de negocio

- `UNMATCHED`: no existe un mapping confiable.
- `UNIT_MISMATCH`: la unidad externa difiere de la unidad del catálogo.
- `CURRENCY_MISMATCH`: la moneda no coincide.
- `INVALID_PRICE`: precio ausente, negativo o inválido.
- `STALE`: la respuesta es válida pero supera el TTL configurado.
- `CONFLICT`: el recurso cambió manualmente después de generar preview.
- `PROVIDER_RATE_LIMITED`: se alcanzó el límite del proveedor.
- `PROVIDER_UNAVAILABLE`: timeout, 5xx o circuit breaker abierto.
- `PERMISSION_DENIED`: el usuario no puede aplicar cambios globales.

Los mensajes para usuario deben ser claros, pero los detalles técnicos deben quedar en logs estructurados y auditoría.

## Aceptación funcional

La especificación se considera satisfecha cuando:

- Un usuario autenticado puede solicitar una consulta para recursos globales.
- El sistema crea un preview persistente y muestra diferencias sin cambiar el catálogo.
- Un actor autorizado puede aplicar un item aprobado.
- El precio aplicado queda en `Resource.unitPrice` con fuente y fechas.
- Un recurso de empresa nunca es actualizado por la request global.
- Un `BudgetItem` o `ApuResource` existente conserva su precio.
- Una aplicación concurrente no sobrescribe una edición manual posterior.
- El cache del catálogo se invalida luego de una aplicación exitosa.
- Las fallas del proveedor no dejan cambios parciales silenciosos.
- El historial permite reconstruir el valor anterior y el nuevo.
- La suite cubre validación, matching, precisión, autorización, idempotencia, cache y rutas.

## Decisiones abiertas antes de producción

1. Contrato y cobertura inicial de `MC Presupuestos Price API Provider` para precios en Perú.
2. Si el proveedor propio será desplegado como servicio separado desde la primera versión o comenzará como stub controlado.
3. Fuentes de datos que alimentarán el proveedor propio y sus acuerdos de uso.
4. Catálogo de unidades y reglas de equivalencia permitidas.
5. TTL por categoría: materiales, mano de obra, equipos, herramientas y subcontratos.
6. Retención del payload crudo y del historial de snapshots.
7. Si `mc-presupuestos-price-api` soportará webhooks o solo polling.
8. Límites mensuales, cuotas y política de continuidad del servicio.

Mientras estas decisiones no estén cerradas, el sistema debe operar con el proveedor principal en estado `disabled` o con un fake provider no productivo. Ningún usuario puede cambiar el proveedor y la aplicación global sigue protegida por aprobación de un administrador de MC Presupuestos.
