# Operación de sincronización de precios de insumos

## Regla de administración

El proveedor principal, sus credenciales, base URL, versión, TTL, límites, mappings, fallback y aplicación al catálogo global son administrados exclusivamente por un administrador de MC Presupuestos.

Los usuarios pueden crear solicitudes desde `/resources`, pero no pueden seleccionar proveedor ni modificar configuración.

## Configuración administrativa

El servicio propio se ejecuta localmente con:

```bash
PRICE_API_SERVICE_TOKEN="token-local" npm run price-api:dev
```

El dataset curado y su versionado viven en `services/mc-presupuestos-price-api/src/catalog.ts`. Antes de activar una versión en producción, MC Presupuestos debe revisar la evidencia de cada precio, incrementar `CATALOG_VERSION`, ejecutar los contract tests y validar el endpoint en staging.

La operación está disponible en `/admin?adminTab=prices` para administradores con `resource_prices.manage`.

Endpoints protegidos:

- `GET /api/admin/resource-price-provider-config`
- `PUT /api/admin/resource-price-provider-config`

El servicio propio expone además `GET /v1/health` y `GET /v1/ready`. El lookup tiene un límite defensivo por proceso configurable con `PRICE_API_RATE_LIMIT_PER_MINUTE`; el gateway productivo debe aplicar el límite distribuido y la allowlist.
- `GET /api/admin/resource-price-providers`
- `POST /api/admin/resource-price-providers/[provider]/test`

La configuración se almacena con la credencial cifrada y la respuesta administrativa solo devuelve una máscara. El proveedor inicia deshabilitado si no existe configuración.

Configuración recomendada para `mc-presupuestos-price-api`:

```json
{
  "provider": "mc-presupuestos-price-api",
  "status": "HEALTHY",
  "baseUrl": "https://price-api.<dominio-controlado>",
  "apiVersion": "v1",
  "timeoutMs": 8000,
  "maxBatchSize": 50,
  "defaultTtlHours": 24,
  "allowFallback": false
}
```

## Flujo operativo

1. El usuario solicita una consulta.
2. El servidor valida sesión y recursos globales.
3. El servidor resuelve el proveedor principal configurado.
4. El adaptador consulta por lotes.
5. El sistema persiste snapshots y genera preview.
6. El administrador MC revisa diferencias.
7. El administrador aplica items compatibles.
8. Se actualiza solo `Resource.unitPrice` global.
9. Se invalidan cache tags del catálogo.
10. Se mantiene intacto el precio de presupuestos y APUs existentes.

## Cron

`GET /api/cron/sync-resource-prices` se ejecuta diariamente a las 08:30 UTC en Vercel y requiere `CRON_SECRET`.

Prueba manual segura:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio-canonico>/api/cron/sync-resource-prices
```

El cron crea un preview programado; no aplica precios automáticamente.

## Estados

- `DISABLED`: no se realizan consultas.
- `HEALTHY`: consultas permitidas.
- `DEGRADED`: consultas permitidas con monitoreo reforzado.
- `SUSPENDED`: consultas bloqueadas por el administrador.
- `PREVIEW_READY`: existen diferencias esperando revisión.
- `APPLIED`: todos los items aplicables fueron aplicados.
- `PARTIALLY_APPLIED`: hubo aplicación parcial o conflictos.
- `FAILED`: el proveedor o la normalización fallaron.

## Rotación y fallback

- Rotar la credencial en el proveedor propio antes de actualizar la configuración de MC.
- Ejecutar health check después de rotar.
- No activar fallback automático sin aprobación y auditoría explícitas.
- Si el proveedor está caído, mantener el catálogo manual operativo y no modificar precios.

## Verificación posterior al despliegue

- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- health check administrativo del proveedor
- cron autorizado devuelve `200`
- cron sin secreto devuelve `401`
- usuario no admin recibe `403` en configuración y aplicación
- una request no modifica `BudgetItem` ni `ApuResource`

## Flujo local versionado (sin API externo)

Mientras el proveedor externo permanezca pospuesto, el catálogo global puede actualizarse desde `/admin?adminTab=prices` mediante el flujo local controlado por `SUPER_ADMIN`:

```text
Excel o tabla administrativa
        ↓
Preview versionado
        ↓
Revisión de filas y conflictos
        ↓
Publicación con MFA
        ↓
Resource global + historial
        ↓
Rollback mediante nueva versión
```

### Importación Excel

Descarga el catálogo actual para editarlo desde el botón **Exportar catálogo actual** o directamente en:

```text
GET /api/admin/resource-prices/local/export
```

También puedes descargar una estructura vacía desde **Descargar plantilla**:

```text
GET /api/admin/resource-prices/local/template
```

La exportación actual conserva `resourceId`, precio vigente, fecha observada y fuente. Ambos archivos son privados y requieren `SUPER_ADMIN` con MFA. El archivo de plantilla contiene las hojas `Precios` e `Instrucciones`.

El archivo `.xlsx` debe incluir, como mínimo, estos encabezados:

| Encabezado | Obligatorio | Descripción |
|---|---:|---|
| `code` o `codigo` | Sí* | Código estable del insumo |
| `description` o `descripcion` | Sí* | Descripción de respaldo |
| `unit` o `unidad` | Sí | Unidad del catálogo |
| `currency` o `moneda` | Sí | Código ISO, inicialmente `PEN` |
| `unitPrice` o `precio` | Sí | Precio no negativo, máximo 4 decimales |
| `resourceId` | Recomendado | ID interno estable; evita ambigüedades |
| `observedAt` o `fecha` | No | Fecha de observación del precio |
| `source` o `fuente` | No | Evidencia/origen del precio |
| `notes` o `notas` | No | Observaciones del administrador |El sistema calcula un hash SHA-256 del archivo, conserva el nombre y no publica ninguna fila durante la importación. Si el mismo archivo ya fue procesado como `EXCEL`, la importación es idempotente: devuelve el preview existente y no crea una nueva versión. Si dos administradores importan simultáneamente, una colisión de unicidad se recupera consultando el lote ganador; para lotes distintos se reintenta la asignación de versión hasta tres veces.
 El matching usa `resourceId`, luego código y finalmente descripción+unidad únicamente si el resultado es único. El flujo recomendado es `exportar catálogo → editar solo precios/metadatos autorizados → importar → revisar preview → publicar`.

### Edición manual

La tabla permite modificar el precio propuesto, pero no escribe directamente en `Resource.unitPrice`. El botón **Crear preview manual** genera un lote `MANUAL` con las diferencias detectadas. Un cambio se considera publicable solo si conserva unidad, moneda y el precio actual capturado en el preview.

### Versiones y publicación

Cada lote obtiene una versión como `20260818-001` y puede quedar en `PREVIEW_READY`, `PUBLISHED`, `REJECTED` o `ROLLED_BACK`. El `SUPER_ADMIN` debe abrir el preview, revisar filas inválidas/actualizadas y confirmar explícitamente la versión para publicar. La publicación es transaccional, registra auditoría y actualiza únicamente el catálogo global (`companyId IS NULL`).

Las filas inválidas no bloquean la revisión del resto, pero nunca se publican. Si el precio vigente cambió después del preview, la publicación se rechaza para evitar sobrescribir una edición concurrente.

### Historial y rollback

Cada precio publicado crea una entrada en `local_resource_price_history` con valor anterior, nuevo valor, lote y actor. La tabla administrativa ofrece **Ver historial** por insumo y permite revisar la línea de tiempo de las últimas 100 modificaciones. El rollback solo está permitido sobre una versión publicada cuyo precio actual todavía coincida con el valor que esa versión publicó. El sistema crea una nueva versión `ROLLBACK`, aplica los valores anteriores y marca la versión original como `ROLLED_BACK`.

### Permisos

Todas las rutas locales requieren `requireSuperAdminSession(request)`, por lo que exigen cuenta activa de administrador principal y prueba MFA:

- `GET/POST /api/admin/resource-prices/local`
- `POST /api/admin/resource-prices/local/import`
- `GET /api/admin/resource-prices/local/export`
- `GET /api/admin/resource-prices/local/template`
- `GET /api/admin/resource-prices/local/history/[resourceId]`
- `GET /api/admin/resource-prices/local/[id]`
- `POST /api/admin/resource-prices/local/[id]/publish`
- `POST /api/admin/resource-prices/local/[id]/reject`
- `POST /api/admin/resource-prices/local/[id]/rollback`

El proveedor externo y este catálogo local son caminos separados: posponer o deshabilitar `mc-presupuestos-price-api` no impide usar la actualización local.

## Aplicación de la migración local

La migración de este flujo es:

```text
prisma/migrations/20260818090000_add_local_resource_price_versions/
```

En una base local o staging revisada:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Antes de producción:

1. ejecutar backup de PostgreSQL;
2. revisar que las tablas `local_resource_price_batches`, `local_resource_price_batch_items` y `local_resource_price_history` estén creadas;
3. confirmar que no se modificaron `BudgetItem`, `ApuResource` ni tablas de cálculo;
4. importar un Excel pequeño en staging;
5. revisar el preview sin publicar;
6. publicar una sola fila de prueba;
7. comprobar historial y rollback;
8. recién después cargar el catálogo operativo.

La aplicación no ejecuta migraciones automáticamente durante el build ni durante el arranque.
