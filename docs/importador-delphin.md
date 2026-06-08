# Importador Delphin Express

Esta guia documenta las reglas usadas para importar archivos `.dprj` de Delphin Express a MYC Presupuestos. Debe usarse como referencia para revisar nuevos archivos Delphin y para evitar regresiones en jerarquia, APUs y advertencias de precio unitario.

## Formato de origen

Los archivos `.dprj` de Delphin Express no son SQLite directo. El archivo analizado esta serializado con BinaryFormatter de .NET y contiene objetos Delphin como proyecto, presupuestos, costos unitarios, subcostos, subtotales y composiciones.

El decoder actual esta en:

- `lib/delphin/dprj-import.ts`

El flujo es:

1. Recibir el buffer `.dprj`.
2. Ejecutar un decoder PowerShell/.NET temporal.
3. Extraer JSON flexible con `project`, `units` y `budgets`.
4. Convertir ese JSON a un snapshot compatible con el mapper S10/MYC.

## Jerarquia de presupuesto

Delphin puede organizar la jerarquia de dos formas. El importador debe distinguirlas por estructura, no solo por nombres.

### Caso 1: presupuesto generico con una raiz

Ejemplo: `PROYECTOdelfin.dprj`.

Si el presupuesto se llama como el proyecto, contiene `PROYECTO` o funciona como contenedor generico, y tiene una sola raiz no partida, esa raiz se toma como sub presupuesto.

Resultado esperado:

```text
Presupuesto generico
+-- ESTRUCTURAS.          -> Sub presupuesto
    +-- OE.2.1             -> Titulo
        +-- OE.2.1.1        -> Subtitulo
            +-- OE.2.1.1.1   -> Partida
```

### Caso 2: varios presupuestos reales

Ejemplo: `Hospital.dprj`.

Cuando el archivo trae varios `Presupuestos`, cada `Presupuesto` es un sub presupuesto real. Sus `Costos` superiores no deben convertirse en sub presupuestos; son titulos internos.

Resultado esperado:

```text
ARQUITECTURA                         -> Sub presupuesto
+-- 1.1 MUROS ...                     -> Titulo
+-- 1.6 PISOS Y PAVIMENTOS            -> Titulo
    +-- 1.6.1 CONTRAPISOS              -> Subtitulo
    +-- 1.6.2 PISOS Y PAVIMENTOS       -> Subtitulo
        +-- 1.6.2.4 PISO DE PORCELANATO -> Partida

ESTRUCTURAS                          -> Sub presupuesto
INSTALACIONES SANITARIAS             -> Sub presupuesto
INSTALACIONES ELECTROMECANICAS       -> Sub presupuesto
```

Regla aplicada:

- `Presupuesto` Delphin = `Sub presupuesto` MYC cuando contiene su propio arbol de costos.
- `Costo` sin unidad ni analisis = nivel jerarquico.
- Primer nivel dentro del sub presupuesto = `TITLE`.
- Niveles internos = `SUBTITLE`.
- `Costo` con unidad, analisis o subtotales = partida importable.

## Mapeo de APU

Para cada partida, el APU se obtiene de `CostoUnitario.Subtotales` como fuente primaria. Si no existe, se usa `AnalisisCosto.Subtotales` como respaldo.

Cada composicion genera una fila APU:

```text
CodInsumo     <- id_listaprecio, codigo_crepco o id_composicion
Descripcion   <- descripcion_composicion
CodUnidad     <- unidad normalizada
Cantidad      <- cantidad_composicion
Precio1       <- costo_composicion
Parcial1      <- parcial_composicion
Tipo          <- MO, MA, EQ, HE o SC segun tipo/codigo/descripcion
```

El importador debe preservar `Precio1`, `Metrado` y `Parcial1` de la partida de origen. Si el APU recalculado no cuadra con el PU de origen, MYC omite el APU de esa partida y muestra warning, para no modificar el presupuesto silenciosamente.

Tolerancia actual:

```text
diferencia <= 0.01 => APU OK
diferencia > 0.01  => PRICE_MISMATCH
```

## Gastos, utilidad, IGV y pie

Delphin guarda tasas y montos por cada `Presupuesto`:

```text
costo_directo
porcentaje_gasto
monto_gasto
porcentaje_utilidad
monto_utilidad
parcial_presupuesto
porcentaje_igv
monto_igv
total_presupuesto
```

Cuando esos datos existen, el importador genera un pie estandar para cada sub presupuesto:

```text
01 COSTO DIRECTO
02 GASTOS GENERALES
03 UTILIDAD
04 SUBTOTAL
05 IGV
06 TOTAL PRESUPUESTO
```

Tambien genera un pie general `999` sumando los sub presupuestos. El mapper MYC usa esas filas para tomar las tasas reales del archivo Delphin y para persistir los montos oficiales del pie como valores manuales.

## Reglas para porcentajes Delphin

Delphin usa varias unidades porcentuales dentro de APUs. Estas reglas son criticas para evitar warnings falsos.

### `%MO`

`%MO` se calcula sobre la suma de mano de obra acumulada.

Ejemplo: `PISO DE PORCELANATO 40x40 CM`.

```text
CAPATAZ                  4.08
OPERARIO                17.39
OFICIAL                  7.75
Base MO                 29.22
HERRAMIENTAS %MO 1%      0.29
```

En Delphin, `Cantidad = 1` significa `1%`. No debe convertirse a `100%`.

### `%` generico

`%` sin sufijo usa como base el `unitPrice` de la misma fila.

Ejemplo: `REVESTIMIENTO DE FACHADA CON ALUZINC`.

```text
ACCESORIOS DE FIJACION
Unidad: %
Cantidad: 20
Precio base: 232.76
Parcial: 46.55

20% x 232.76 = 46.55
```

### Porcentajes encadenados

Una fila `%` generica ya calculada tambien debe alimentar el subtotal base de su categoria para porcentajes posteriores.

Ejemplo: `INSTALACION DE DRENAJE`.

```text
MANO DE OBRA DE INSTALACION  %    40 x 52.38 = 20.95
HERRAMIENTAS MANUALES        %MO   3 x 20.95 = 0.63
```

Si la fila de mano de obra porcentual no alimenta la base de MO, MYC calcula el APU como `73.33` en vez de `73.96`.

## Casos de regresion obligatorios

Los siguientes casos deben permanecer cubiertos por tests cuando se modifique el importador Delphin o el calculador APU.

### `PROYECTOdelfin.dprj`

- Debe importar `ESTRUCTURAS.` como sub presupuesto.
- Debe conservar titulos/subtitulos.
- No debe generar APUs con warning.

### `Hospital.dprj`

- Debe importar exactamente 4 sub presupuestos:
  - `ARQUITECTURA`
  - `ESTRUCTURAS`
  - `INSTALACIONES SANITARIAS`
  - `INSTALACIONES ELECTROMECANICAS`
- `1.1` debe quedar como `TITLE`, no como sub presupuesto.
- `1.6.1` debe quedar como `SUBTITLE`.
- `PISO DE PORCELANATO 40x40 CM` debe quedar con APU OK y PU `89.36`.
- `REVESTIMIENTO DE FACHADA CON ALUZINC` debe quedar con APU OK y PU `345.48`.
- Las tres partidas `INSTALACION DE DRENAJE` deben quedar con APU OK y PU `73.96`.
- El archivo completo debe quedar sin `PRICE_MISMATCH` en `itemMetadata`.

## Checklist para nuevos archivos Delphin

Al probar otro `.dprj`, ejecutar estas verificaciones:

1. Confirmar cantidad de sub presupuestos contra Delphin.
2. Confirmar que titulos y subtitulos no aparezcan como sub presupuestos.
3. Revisar una partida con APU simple y otra con porcentajes.
4. Comparar `Precio1` de partida contra suma recalculada del APU.
5. Listar `itemMetadata` con `apuStatus !== "OK"`.
6. Si hay diferencias, revisar si son:
   - APU incompleto en origen.
   - Fila porcentual con base distinta.
   - Redondeo mayor a `0.01`.
   - Unidad no normalizada.
   - Subtotal externo que aun no esta modelado.

Comando util para pruebas enfocadas:

```powershell
npm.cmd run test -- lib/calculations/apu.test.ts lib/delphin/dprj-import.test.ts lib/s10/import-mapper.test.ts
```

Validacion completa antes de cerrar cambios:

```powershell
npm.cmd run lint
```
