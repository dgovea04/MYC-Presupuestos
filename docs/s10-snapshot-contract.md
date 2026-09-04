# Contrato de snapshot JSON S10

El snapshot S10 es el puente entre SQL Server local, la futura aplicación desktop y la web de MC Presupuestos. El contrato es un JSON autocontenido; no incluye credenciales, sesiones ni rutas de archivos locales.

## Envoltorio versionado

```json
{
  "schema": "mc.s10.snapshot",
  "contractVersion": "1.0.0",
  "exportedAt": "2026-08-10T12:00:00.000Z",
  "source": {
    "system": "S10",
    "adapter": "sqlserver",
    "databaseName": "S10_OBRA_MYC",
    "budgetCode": "0302044"
  },
  "payload": {
    "presupuestos": [],
    "subpresupuestos": [],
    "partidas": [],
    "apuDetalles": [],
    "budgetLevels": [],
    "subpresupuestoDetalles": [],
    "pieSubpresupuestos": [],
    "resultadoPieSubpresupuestos": []
  }
}
```

### Campos de control

- `schema`: identificador estable del tipo de documento.
- `contractVersion`: versión semver del contrato. La versión `1.x` es compatible dentro de su major; cambios incompatibles requieren `2.0.0`.
- `exportedAt`: fecha ISO-8601 de generación.
- `source.system`: siempre `S10`.
- `source.adapter`: `sqlserver`, `desktop`, `legacy` o `db`.
- `source.databaseName` y `source.budgetCode`: metadatos opcionales de trazabilidad; no son necesarios para importar.
- `payload`: el modelo de filas S10 que consume el mapper de MC.

## Compatibilidad

La web acepta dos entradas:

1. El contrato versionado `mc.s10.snapshot`.
2. El formato plano legacy que ya exportaban las versiones anteriores.

Los snapshots legacy se normalizan en memoria a `contractVersion: 1.0.0` y se pueden actualizar con el CLI local. Un major diferente a `1` se rechaza explícitamente; no se intenta interpretar silenciosamente un contrato futuro.

## Herramienta local

Validar un snapshot y mostrar sus conteos:

```powershell
npm.cmd run s10:snapshot -- --input data-for-seed\s10-export-preview.json
```

Convertir un snapshot plano legacy a un archivo versionado:

```powershell
npm.cmd run s10:snapshot -- --input legacy.json --out data-for-seed\s10-export-versioned.json
```

El exportador SQL Server también genera directamente el envoltorio versionado:

```powershell
npm.cmd run s10:sqlserver -- --export --database S10_OBRA_MYC --budget 0302044 --out data-for-seed\s10-export-0302044.json
```

La futura app desktop debe producir este mismo contrato y usar el `payload` como salida de su adaptador S10. La web no necesita conectarse a SQL Server ni recibir archivos `.S2K`.

## Reglas de seguridad y precisión

- El contrato no debe transportar contraseñas SQL, tokens ni rutas de backup.
- Los números se conservan como los entrega el exportador actual; los cálculos posteriores del mapper usan `decimal.js`.
- Los arreglos base requeridos son `presupuestos`, `subpresupuestos`, `partidas` y `apuDetalles`. Los arreglos complementarios son opcionales para compatibilidad con snapshots antiguos.
- Antes de persistir, la web vuelve a validar el contrato y el mapper mantiene sus advertencias de APU, metrados y unidades.
