# MC Presupuestos Price API Provider

## Propósito

`mc-presupuestos-price-api` es el proveedor de primera parte para cotizaciones de insumos. Su configuración y operación pertenecen exclusivamente a MC Presupuestos. Los usuarios finales no pueden seleccionar el proveedor, cambiar su endpoint ni administrar sus credenciales.

La WebApp consume este servicio mediante `lib/resource-pricing/provider.ts`. La WebApp sigue siendo responsable de generar preview, aprobar y persistir el precio vigente en el catálogo global.

## Contrato V1

Base URL configurada únicamente por el administrador de MC Presupuestos.

### Health y readiness

```http
GET /v1/health
Authorization: Bearer <service-credential>
```

`/v1/health` confirma la versión y la fecha del servicio. `/v1/ready` confirma que el token está configurado y que existe un dataset servido; ambos requieren autenticación servicio-a-servicio.

```http
GET /v1/ready
Authorization: Bearer <service-credential>
```

Respuesta:

```json
{
  "ok": true,
  "service": "mc-presupuestos-price-api",
  "version": "v1",
  "catalogVersion": "2026-08-17.1",
  "checkedAt": "2026-08-17T12:00:00.000Z"
}
```

### Lookup de precios

```http
POST /v1/resource-prices:lookup
Authorization: Bearer <service-credential>
Content-Type: application/json
```

Request:

```json
{
  "resources": [
    {
      "externalResourceId": "cemento-portland-tipo-i",
      "externalCode": "MAT-001",
      "description": "Cemento Portland Tipo I",
      "category": "MATERIAL",
      "unit": "bol",
      "currency": "PEN"
    }
  ]
}
```

Response:

```json
[
  {
    "externalResourceId": "cemento-portland-tipo-i",
    "externalCode": "MAT-001",
    "description": "Cemento Portland Tipo I",
    "category": "MATERIAL",
    "unit": "bol",
    "currency": "PEN",
    "price": "27.4500",
    "observedAt": "2026-08-17T11:45:00.000Z",
    "sourceLabel": "MC Presupuestos Price API",
    "sourceVersion": "2026-08-17.1",
    "rawHash": "sha256:..."
  }
]
```

## Reglas del contrato

- `price` siempre es string decimal con máximo cuatro posiciones operativas.
- `currency` usa código ISO, inicialmente `PEN`.
- `unit` debe coincidir con una unidad conocida por el catálogo o producir revisión.
- `observedAt` representa la fecha real de la fuente, no la fecha de recepción.
- `sourceVersion` permite reproducir la cotización.
- El servicio nunca recibe sesiones de usuario final.
- El servicio debe soportar límites de lote y respuestas acotadas.

## Errores

Usar respuestas tipadas sin incluir secretos:

- `401 AUTHENTICATION_FAILED`
- `403 CONSUMER_NOT_ALLOWED`
- `400 INVALID_REQUEST`
- `404 VERSION_NOT_FOUND`
- `409 CATALOG_CONFLICT`
- `429 RATE_LIMITED`
- `503 DATA_UNAVAILABLE`

## Seguridad y operación

- Credenciales servicio-a-servicio rotables.
- Allowlist de consumidores por entorno.
- Base URL y versión configuradas solo por administrador MC.
- No aceptar URLs arbitrarias desde la WebApp.
- TLS obligatorio en staging y producción.
- Logs con request id, latencia, versión de catálogo y resultado; nunca bearer tokens.
- Health y readiness separados.
- Datasets y acuerdos de uso de fuentes documentados antes de activación productiva.

## Estado actual de implementación

El servicio V1 está implementado en `services/mc-presupuestos-price-api` como un runtime HTTP Node independiente del proceso Next.js. Incluye:

- handler puro testeable;
- servidor HTTP ejecutable con `npm run price-api:dev`;
- autenticación Bearer servicio-a-servicio;
- dataset curado versionado `2026-08-17.1`;
- matching por identificador externo, código o descripción/unidad;
- contract tests del servicio y del adaptador de la WebApp.

El dataset inicial contiene fixtures curadas de referencia y no debe considerarse una fuente productiva hasta validar evidencia, cobertura, vigencia y aprobación comercial de cada precio. El proveedor permanece `DISABLED` en la WebApp hasta desplegarlo en staging/producción y configurar sus credenciales desde la administración de MC Presupuestos. El provider fake continúa reservado para desarrollo y pruebas automatizadas.

## Variables del servicio propio

```env
PRICE_API_PORT=8787
PRICE_API_SERVICE_TOKEN=<token-rotatable-por-entorno>
PRICE_API_MAX_BATCH_SIZE=50
PRICE_API_RATE_LIMIT_PER_MINUTE=120
```

La WebApp usa su propia configuración administrativa cifrada (`baseUrl`, `apiVersion` y credencial). No se debe exponer el token en variables públicas, logs ni respuestas HTTP.
