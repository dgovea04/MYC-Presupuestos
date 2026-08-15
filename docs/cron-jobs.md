# Cron jobs — MC Presupuestos

Los jobs están definidos en `vercel.json` y se ejecutan diariamente a las `08:00 UTC` en el entorno desplegado:

| Endpoint | Propósito |
|---|---|
| `GET /api/cron/reactivate-members` | Reactivar membresías suspendidas cuyo `suspendedUntil` ya venció. |
| `GET /api/cron/notify-deletion-reminders` | Notificar al administrador principal sobre eliminaciones cuyo periodo de gracia venció. No elimina cuentas automáticamente. |

## Configuración

1. Configurar `CRON_SECRET` en Vercel para el entorno correspondiente.
2. Confirmar que `vercel.json` está incluido en el commit desplegado.
3. Confirmar en el panel de Vercel que aparecen ambos jobs y su próximo horario.
4. Revisar los Runtime Logs después de la primera ejecución.

Vercel envía el header:

```text
Authorization: Bearer <CRON_SECRET>
```

El código también admite `?secret=...` por compatibilidad, pero no debe usarse en operación normal porque el secreto puede quedar expuesto en URLs, historial o logs.

## Prueba manual

No incluir el secreto directamente en el historial de shell:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio-canonico>/api/cron/reactivate-members

curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio-canonico>/api/cron/notify-deletion-reminders
```

Resultados esperados:

- `200`: token válido y operación completada.
- `401`: token ausente, incorrecto o con formato inválido.
- `500`: `CRON_SECRET` no está configurado o la operación interna falló.

## Reactivación de membresías

`/api/cron/reactivate-members` ejecuta una actualización sobre membresías con:

- `status = SUSPENDED`
- `suspendedUntil` no nulo
- `suspendedUntil <= NOW()`

La respuesta incluye el número de membresías reactivadas y la hora de comprobación:

```json
{
  "reactivated": 3,
  "checkedAt": "2026-07-07T12:00:00.000Z"
}
```

El cron es una capa de defensa adicional. La lista de miembros y las comprobaciones de acceso también deben impedir el acceso mientras una membresía siga suspendida.

## Recordatorios de eliminación

`/api/cron/notify-deletion-reminders` llama a `notifyDueAdminDeletions()` y devuelve el resultado del procesamiento junto con `checkedAt`.

- Solo notifica solicitudes vencidas que aún corresponda recordar.
- No ejecuta eliminaciones permanentes.
- La eliminación definitiva continúa requiriendo autorización del administrador principal y MFA.
- Revisar los logs de Resend y la auditoría administrativa si un envío falla.

## Seguridad y operación

- [ ] Mantener `CRON_SECRET` fuera del código fuente, URLs y logs.
- [ ] Usar un secreto distinto en Preview y Production.
- [ ] No ejecutar estos endpoints sin bearer auth en producción.
- [ ] Confirmar que no existen jobs duplicados en otro scheduler.
- [ ] Revisar errores 5xx y timeouts después de cada despliegue.
- [ ] Si se rota `CRON_SECRET`, actualizar Vercel antes de la siguiente ejecución y repetir la prueba manual.

Vercel Cron no se ejecuta con `npm run dev`; para probar localmente se debe iniciar la aplicación y llamar los endpoints con `CRON_SECRET` configurado.
