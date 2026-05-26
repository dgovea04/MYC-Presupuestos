# QA manual - IA local MYC Presupuestos

Checklist operativo para validar la integracion local con Ollama antes de entregar una iteracion.

## Salud del runtime

- Ollama activo: abrir `/ai` y confirmar estado conectado.
- Ollama caido: detener Ollama y confirmar mensaje funcional de conexion.
- `mistral` ausente: confirmar fallback a `llama3.1` en APU/autocomplete.
- `llama3.1` ausente: confirmar error funcional de modelo faltante.

## Chat tecnico

- Ejecutar una consulta tecnica desde `/ai`.
- Confirmar que responde con modelo real usado.
- Confirmar que muestra warnings si hay fallback o error recuperable.
- Desde una partida/APU, usar `Explicar partida` y validar contexto de descripcion/unidad.

## Generar APU

- En una partida editable, usar `Generar con IA`.
- Confirmar preview con materiales, mano de obra, equipos, rendimiento, cuadrilla, observaciones y supuestos.
- Confirmar que `Aplicar propuesta` deja cambios como borrador y no guarda automaticamente.
- Confirmar que `Descartar` no cambia filas APU.
- Confirmar que recursos sugeridos entran con precio unitario `0` cuando no hay match validado.
- En partida readonly, confirmar que la accion IA queda deshabilitada.

## Presupuesto

- Abrir menu de una partida y confirmar acciones `Explicar partida con IA`, `Autocompletar descripcion` y `Sugerir APU`.
- Ejecutar `Autocompletar descripcion`.
- Confirmar preview antes de aplicar.
- Confirmar que `Aplicar texto` cambia la descripcion y `Descartar` no la cambia.
- Ejecutar `Revisar presupuesto con IA` desde acciones globales.
- Confirmar hallazgos estructurados con severidad, tipo, impacto y accion recomendada.

## Regresion

- Confirmar que endpoints IA sin sesion siguen devolviendo `401`.
- Confirmar que `/ai` sigue funcionando como laboratorio y diagnostico.
- Ejecutar `npm run lint`.
- Ejecutar `npm run test`.
- Ejecutar `node ./node_modules/next/dist/bin/next build`.
