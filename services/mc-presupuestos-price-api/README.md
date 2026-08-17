# MC Presupuestos Price API

Servicio de primera parte para servir precios curados del catálogo de insumos a la WebApp.

## Ejecución local

Desde la raíz del repositorio:

```bash
PRICE_API_SERVICE_TOKEN="token-local" npm run price-api:dev
```

Variables disponibles:

```env
PRICE_API_PORT=8787
PRICE_API_SERVICE_TOKEN=token-local
PRICE_API_MAX_BATCH_SIZE=50
PRICE_API_RATE_LIMIT_PER_MINUTE=120
```

El servicio expone:

- `GET /v1/health`
- `GET /v1/ready`
- `POST /v1/resource-prices:lookup`
- `GET /v1/catalog/resources`
- `GET /v1/catalog/versions/:version`

Todas las rutas requieren:

```text
Authorization: Bearer <PRICE_API_SERVICE_TOKEN>
```

## Dataset curado

El dataset inicial está en `src/catalog.ts` y se identifica con `CATALOG_VERSION` en `src/contract.ts`.

Para publicar una actualización:

1. Revisar y aprobar la fuente de cada precio.
2. Modificar las entradas curadas.
3. Incrementar `CATALOG_VERSION` sin reutilizar una versión publicada.
4. Ejecutar `npm run price-api:typecheck`.
5. Ejecutar `npm run test:price-api`.
6. Ejecutar el health check y una consulta de staging.
7. Configurar la nueva URL/credencial desde la administración de MC Presupuestos solo después del canary.

El servicio no acepta precios enviados por el consumidor como fuente de verdad. `currentPrice` solo sirve como contexto para el matching y nunca sobrescribe el dataset.

## Seguridad

- No registrar bearer tokens.
- Usar TLS fuera de desarrollo local.
- Utilizar tokens distintos por entorno.
- Rotar `PRICE_API_SERVICE_TOKEN` coordinadamente con la configuración cifrada de la WebApp.
- Aplicar allowlist de consumidores y rate limiting en el gateway de producción; el servicio también incluye un límite defensivo por proceso.
- Mantener el dataset y su evidencia de fuente bajo revisión de MC Presupuestos.

## Contrato

La especificación funcional está en `docs/mc-presupuestos-price-api-provider.md`. El handler puro y los contract tests están en `src/handler.ts` y `src/handler.test.ts`.
