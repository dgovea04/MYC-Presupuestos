# Separación de capacidades online y locales

## Objetivo

MC Presupuestos se ejecuta en dos contextos distintos:

- **Web online:** Next.js desplegado en Vercel.
- **App local/desktop:** proceso instalado en el equipo del usuario, con acceso a servicios y archivos locales.

Las funcionalidades que requieren `localhost`, SQL Server, `sqlcmd`, rutas del sistema o ejecutables nativos no deben depender de una función serverless de Vercel.

## Clasificación actual

| Funcionalidad | Web online | App local/desktop | Decisión |
| --- | --- | --- | --- |
| Importar snapshot JSON S10 | Sí | Sí | Flujo online principal |
| Analizar `.S2K` en el navegador | Sí, leyendo solo el encabezado | Sí | Híbrida; no sube el archivo completo para detectar el tipo |
| SQL Server S10 / `sqlcmd` | No | Sí | Solo local; UI y API protegidas |
| Restaurar respaldo `.S2K` en SQL Server | No | Sí | Solo local; reservar para desktop |
| Importador MCP | Sí, vía upload HTTP | Sí | Online |
| Importador RW7 | Sí, vía upload HTTP | Sí | Online |
| Importador Delphin | Sí, vía upload HTTP | Sí | Online mientras el parser siga siendo puro TypeScript |
| Ollama | No en Vercel | Sí | Solo local; no se intenta acceder a `localhost:11434` en producción |
| ChatGPT Bridge | Sí, desde la extensión del navegador | Sí | Híbrida de navegador; no confundir con Ollama |
| localStorage / historial de sesión | Sí | Sí | Cliente, compatible con web |
| Web Workers / Monte Carlo | Sí | Sí | Cliente, compatible con web |

## Reglas técnicas

Las funciones `isLocalServerRuntimeEnabled()` e `isLocalClientRuntimeEnabled()` separan las compuertas. En producción:

- se oculta la tarjeta de configuración de Ollama;
- se elimina Ollama del selector de proveedores y del proveedor automático;
- las rutas de health/check de Ollama responden `403`;
- la ejecución directa del proveedor Ollama responde `403`;
- SQL Server/S2K conserva la protección existente y responde `403`.

En desarrollo y tests, estas capacidades permanecen disponibles para probar la futura integración desktop. La app desktop puede habilitar el servidor local con `MYC_ENABLE_LOCAL_SERVICES=true` y alinear la interfaz con `NEXT_PUBLIC_ENABLE_LOCAL_SERVICES=true`. La variable pública nunca habilita por sí sola las APIs server-side.

## Guía para nuevas funcionalidades

Una capacidad puede mantenerse online si procesa un archivo subido por HTTP y no necesita ejecutar binarios, abrir rutas locales ni conectarse a servicios del equipo del usuario. Si necesita esas dependencias, debe:

1. exponerse únicamente detrás de la compuerta local;
2. mostrar una etiqueta **Solo local** en desarrollo;
3. devolver un rechazo explícito desde la API en producción;
4. reutilizar la misma interfaz de datos para que la app desktop pueda actuar como adaptador local.
