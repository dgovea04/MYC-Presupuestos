# Funcionalidad: Cálculo de Fórmula Polinómica para Presupuestos de Obra en Perú

## 1. Objetivo de la funcionalidad

Agregar a la web app de presupuestos una funcionalidad para construir, validar y aplicar una **fórmula polinómica de reajuste de precios** para obras de edificación de vivienda en Perú.

La funcionalidad debe permitir que el usuario:

1. Genere la fórmula polinómica a partir del presupuesto base y sus Análisis de Precios Unitarios (APU).
2. Agrupe los costos por naturaleza: mano de obra, materiales, equipos, varios, gastos generales y utilidad.
3. Calcule los coeficientes de incidencia de cada monomio.
4. Seleccione índices de precios base y de reajuste.
5. Calcule el coeficiente de reajuste `K`.
6. Aplique el reajuste a una valorización mensual.
7. Genere un reporte técnico exportable.

---

## 2. Contexto normativo peruano

En Perú, la fórmula polinómica se utiliza para el **reajuste automático de precios** de una obra, principalmente en contratos ejecutados en moneda nacional.

La referencia normativa clásica es el **Decreto Supremo N.° 011-79-VC**, que establece la forma general del coeficiente de reajuste `K`.

La fórmula polinómica no se usa para crear el presupuesto inicial. Su función principal es **actualizar o reajustar valorizaciones** cuando varían los precios de los insumos durante la ejecución de la obra.

---

## 3. Conceptos principales

### 3.1 Presupuesto base

El presupuesto base es el presupuesto aprobado inicialmente para la obra.

Estructura general:

```txt
Presupuesto = Costo Directo + Gastos Generales + Utilidad + IGV
```

Para el cálculo de la fórmula polinómica se analiza principalmente la estructura económica del presupuesto, especialmente:

```txt
Costo Directo = Mano de Obra + Materiales + Equipos + Otros
```

---

### 3.2 Análisis de Precio Unitario, APU

Cada partida del presupuesto debe tener un Análisis de Precio Unitario.

Forma general:

```txt
PU = MO + MAT + EQ + Otros
```

Donde:

| Componente | Descripción |
|---|---|
| `MO` | Mano de obra |
| `MAT` | Materiales |
| `EQ` | Equipos, maquinaria o herramientas |
| `Otros` | Subcontratos, varios u otros costos directos |

El importe de cada partida se calcula así:

```txt
Importe de partida = Metrado × Precio Unitario
```

---

### 3.3 Fórmula polinómica

La forma general es:

```txt
K = a(Jr/Jo) + b(Mr/Mo) + c(Er/Eo) + d(Vr/Vo) + e(GUr/GUo)
```

Donde:

| Símbolo | Significado |
|---|---|
| `K` | Coeficiente de reajuste |
| `a, b, c, d, e` | Coeficientes de incidencia de cada grupo de costo |
| `J` | Mano de obra |
| `M` | Materiales |
| `E` | Equipos |
| `V` | Varios |
| `GU` | Gastos generales + utilidad |
| Subíndice `o` | Índice base, correspondiente al mes del presupuesto base |
| Subíndice `r` | Índice de reajuste, correspondiente al mes de valorización |

---

## 4. Reglas normativas importantes

La funcionalidad debe validar estas reglas:

### 4.1 Suma de coeficientes

La suma de los coeficientes debe ser igual a `1.000`.

```txt
a + b + c + d + e = 1.000
```

Si existen más monomios:

```txt
a + b + c + d + e + f + g + h = 1.000
```

---

### 4.2 Número máximo de monomios

La fórmula puede tener varios monomios, pero normalmente no debe exceder **8 monomios**.

Ejemplo:

```txt
K = a(Jr/Jo) + b(Acero_r/Acero_o) + c(Cemento_r/Cemento_o) + d(Ladrillo_r/Ladrillo_o) + e(Equipo_r/Equipo_o) + f(GUr/GUo)
```

---

### 4.3 Coeficiente mínimo recomendado

Cada coeficiente individual debe ser representativo. Según la práctica normativa, se debe evitar crear monomios con incidencia menor a `0.05`.

```txt
coeficiente >= 0.05
```

Si un componente tiene incidencia menor a `0.05`, debe agruparse con otro componente compatible.

---

### 4.4 Gastos generales y utilidad

Los gastos generales y la utilidad se consideran usualmente como un solo monomio:

```txt
GU = Gastos Generales + Utilidad
```

---

## 5. Proceso paso a paso para construir la fórmula polinómica

## Paso 1: Elaborar el presupuesto base

El sistema debe partir de un presupuesto estructurado por niveles, partidas y metrados.

Ejemplo de estructura:

```txt
01 Obras provisionales
02 Estructuras
03 Arquitectura
04 Instalaciones sanitarias
05 Instalaciones eléctricas
06 Gastos generales
07 Utilidad
```

Cada partida debe tener:

- Código
- Descripción
- Unidad
- Metrado
- Precio unitario
- Importe
- APU asociado

---

## Paso 2: Leer los APU de cada partida

Cada APU debe descomponer el precio unitario en componentes.

Ejemplo:

| Partida | Mano de obra | Materiales | Equipo | Otros | Total PU |
|---|---:|---:|---:|---:|---:|
| Concreto f'c 210 kg/cm² | 25.00 | 280.00 | 35.00 | 0.00 | 340.00 |
| Encofrado | 40.00 | 55.00 | 10.00 | 0.00 | 105.00 |
| Acero corrugado | 30.00 | 310.00 | 15.00 | 0.00 | 355.00 |

Validación:

```txt
PU calculado = MO + MAT + EQ + Otros
```

El sistema debe comparar el PU calculado contra el PU registrado.

---

## Paso 3: Multiplicar componentes por metrado

Para obtener el costo real de cada componente en el presupuesto, se debe multiplicar cada componente del APU por el metrado de la partida.

Fórmulas:

```txt
MO_partida = MO_unitario × Metrado
MAT_partida = MAT_unitario × Metrado
EQ_partida = EQ_unitario × Metrado
Otros_partida = Otros_unitario × Metrado
```

Ejemplo:

```txt
Metrado = 100 m³
MO_unitario = 25.00
MAT_unitario = 280.00
EQ_unitario = 35.00

MO_partida = 25.00 × 100 = 2,500.00
MAT_partida = 280.00 × 100 = 28,000.00
EQ_partida = 35.00 × 100 = 3,500.00
```

---

## Paso 4: Agrupar costos por naturaleza

El sistema debe sumar todos los componentes del presupuesto por grupo económico.

Grupos base:

| Grupo | Variable |
|---|---|
| Mano de obra | `MO_total` |
| Materiales | `MAT_total` |
| Equipos | `EQ_total` |
| Varios u otros | `V_total` |
| Gastos generales + utilidad | `GU_total` |

Fórmulas:

```txt
MO_total = suma de todos los MO_partida
MAT_total = suma de todos los MAT_partida
EQ_total = suma de todos los EQ_partida
V_total = suma de todos los Otros_partida
GU_total = Gastos Generales + Utilidad
```

---

## Paso 5: Calcular el total base para la fórmula

El total base para los coeficientes debe ser la suma de los grupos que participan en la fórmula.

```txt
Total_base = MO_total + MAT_total + EQ_total + V_total + GU_total
```

Nota: El IGV normalmente no debe formar parte de los coeficientes de la fórmula polinómica, porque es un impuesto y no un componente económico del costo de obra.

---

## Paso 6: Calcular coeficientes de incidencia

Cada coeficiente se calcula dividiendo el monto del grupo entre el total base.

```txt
a = MO_total / Total_base
b = MAT_total / Total_base
c = EQ_total / Total_base
d = V_total / Total_base
e = GU_total / Total_base
```

Ejemplo:

| Grupo | Monto | Coeficiente |
|---|---:|---:|
| Mano de obra | 180,000.00 | 0.180 |
| Materiales | 520,000.00 | 0.520 |
| Equipo | 70,000.00 | 0.070 |
| Varios | 30,000.00 | 0.030 |
| Gastos generales + utilidad | 200,000.00 | 0.200 |
| Total | 1,000,000.00 | 1.000 |

Fórmula resultante:

```txt
K = 0.180(Jr/Jo) + 0.520(Mr/Mo) + 0.070(Er/Eo) + 0.030(Vr/Vo) + 0.200(GUr/GUo)
```

---

## Paso 7: Validar coeficientes

El sistema debe validar:

```txt
suma_coeficientes = a + b + c + d + e
```

Condición esperada:

```txt
suma_coeficientes = 1.000
```

Debe permitirse una tolerancia por redondeo.

Recomendación:

```txt
tolerancia = ±0.001
```

Validación:

```txt
abs(suma_coeficientes - 1.000) <= 0.001
```

Si algún coeficiente es menor a `0.05`, el sistema debe alertar:

```txt
Este monomio tiene una incidencia menor a 0.05. Se recomienda agruparlo con otro monomio compatible.
```

---

## Paso 8: Seleccionar índices unificados

El usuario debe seleccionar los índices correspondientes para cada monomio.

Los índices pueden provenir de los Índices Unificados de Precios de la Construcción publicados por el INEI.

Para cada monomio se debe registrar:

| Campo | Descripción |
|---|---|
| `indice_codigo` | Código del índice unificado |
| `indice_nombre` | Nombre del índice |
| `indice_base` | Valor del índice en el mes base |
| `indice_reajuste` | Valor del índice en el mes de valorización |
| `mes_base` | Mes del presupuesto base |
| `mes_reajuste` | Mes de la valorización |

---

## Paso 9: Calcular relación de índices

Para cada monomio:

```txt
relacion = indice_reajuste / indice_base
```

Ejemplo:

```txt
J_relacion = Jr / Jo
M_relacion = Mr / Mo
E_relacion = Er / Eo
V_relacion = Vr / Vo
GU_relacion = GUr / GUo
```

---

## Paso 10: Calcular coeficiente K

La fórmula general del sistema debe ser:

```txt
K = suma(coeficiente_i × relacion_indice_i)
```

Forma programática:

```txt
K = Σ(coeficiente_i * (indice_reajuste_i / indice_base_i))
```

Ejemplo:

| Grupo | Coeficiente | Índice base | Índice reajuste | Relación | Parcial |
|---|---:|---:|---:|---:|---:|
| Mano de obra | 0.180 | 100 | 108 | 1.080 | 0.1944 |
| Materiales | 0.520 | 100 | 115 | 1.150 | 0.5980 |
| Equipo | 0.070 | 100 | 105 | 1.050 | 0.0735 |
| Varios | 0.030 | 100 | 102 | 1.020 | 0.0306 |
| GG + Utilidad | 0.200 | 100 | 110 | 1.100 | 0.2200 |
| Total | 1.000 | - | - | - | 1.1165 |

Resultado:

```txt
K = 1.1165
```

Redondeado al milésimo:

```txt
K = 1.117
```

---

## Paso 11: Aplicar reajuste a una valorización

Fórmula:

```txt
Valorizacion_reajustada = Valorizacion_original × K
```

Reajuste:

```txt
Reajuste = Valorizacion_reajustada - Valorizacion_original
```

Ejemplo:

```txt
Valorizacion_original = 100,000.00
K = 1.117

Valorizacion_reajustada = 100,000.00 × 1.117
Valorizacion_reajustada = 111,700.00

Reajuste = 111,700.00 - 100,000.00
Reajuste = 11,700.00
```

---

## 6. Proceso específico para vivienda

En una obra de edificación de vivienda, los monomios pueden organizarse según los componentes más incidentes del presupuesto.

Ejemplo de grupos recomendados:

| Grupo | Ejemplos |
|---|---|
| Mano de obra | Operario, oficial, peón |
| Cemento/concreto | Cemento, concreto premezclado, agregados |
| Acero | Acero corrugado, mallas, alambre |
| Albañilería | Ladrillo, bloque, morteros |
| Instalaciones | Tuberías, cables, aparatos sanitarios, accesorios eléctricos |
| Equipo | Mezcladora, vibradora, herramientas, maquinaria menor |
| Gastos generales + utilidad | Administración, oficina técnica, utilidad |

Ejemplo de fórmula más detallada:

```txt
K = a(Jr/Jo) + b(Acero_r/Acero_o) + c(Cemento_r/Cemento_o) + d(Ladrillo_r/Ladrillo_o) + e(Instalaciones_r/Instalaciones_o) + f(Equipo_r/Equipo_o) + g(GUr/GUo)
```

Regla importante: los coeficientes no deben inventarse. Deben calcularse desde el presupuesto real y los APU.

---

## 7. Requerimientos funcionales para la web app

## RF-01: Crear fórmula polinómica desde presupuesto

El usuario debe poder seleccionar un presupuesto y generar automáticamente una fórmula polinómica preliminar.

### Inputs

- ID del presupuesto
- Partidas con metrados
- APU de cada partida
- Gastos generales
- Utilidad
- Mes base del presupuesto

### Output

- Lista de monomios sugeridos
- Coeficientes calculados
- Fórmula textual generada
- Validaciones normativas

---

## RF-02: Editar monomios

El usuario debe poder modificar los monomios sugeridos.

Debe poder:

- Crear monomio
- Editar nombre del monomio
- Asignar componentes de costo al monomio
- Agrupar componentes pequeños
- Eliminar monomio
- Recalcular coeficientes

---

## RF-03: Validar fórmula

El sistema debe validar:

1. La suma de coeficientes es igual a `1.000`.
2. No existen más de `8` monomios.
3. Ningún coeficiente es menor a `0.05`, salvo advertencia permitida.
4. Cada monomio tiene índice base asignado.
5. Cada monomio tiene índice de reajuste asignado para calcular `K`.
6. El IGV no se incluye en la base de coeficientes.

---

## RF-04: Calcular K

El usuario debe poder ingresar o seleccionar los índices de reajuste para una valorización.

El sistema debe calcular:

```txt
K = Σ(coeficiente_i × indice_reajuste_i / indice_base_i)
```

Debe mostrar:

- Relación de índice por monomio
- Parcial por monomio
- K sin redondear
- K redondeado al milésimo

---

## RF-05: Aplicar K a una valorización

El usuario debe poder seleccionar una valorización y aplicar el coeficiente `K`.

El sistema debe calcular:

```txt
Valorizacion_reajustada = Valorizacion_original × K
Reajuste = Valorizacion_reajustada - Valorizacion_original
```

Debe mostrar:

- Valor original
- K aplicado
- Valor reajustado
- Monto de reajuste

---

## RF-06: Generar reporte

El sistema debe generar un reporte con:

1. Datos del proyecto
2. Presupuesto base
3. Mes base
4. Tabla de monomios
5. Coeficientes
6. Índices base y reajuste
7. Cálculo de K
8. Aplicación del reajuste
9. Observaciones normativas
10. Firma o responsable técnico, opcional

Formatos deseados:

- PDF
- Excel
- Markdown

---

## 8. Modelo de datos sugerido

### 8.1 Tabla: `polynomial_formulas`

```sql
id
project_id
budget_id
name
base_month
base_year
total_base_amount
status
created_at
updated_at
```

---

### 8.2 Tabla: `polynomial_formula_terms`

```sql
id
formula_id
term_order
term_code
term_name
cost_group
coefficient
base_index_code
base_index_name
base_index_value
created_at
updated_at
```

Ejemplo de `cost_group`:

```txt
labor
materials
steel
cement
masonry
installations
equipment
general_expenses_profit
others
```

---

### 8.3 Tabla: `polynomial_formula_term_components`

Esta tabla vincula cada monomio con los componentes del presupuesto o APU que lo alimentan.

```sql
id
formula_term_id
budget_item_id
apu_resource_id
resource_type
amount
created_at
updated_at
```

---

### 8.4 Tabla: `construction_price_indices`

```sql
id
code
name
category
geographic_area
month
year
value
source
created_at
updated_at
```

---

### 8.5 Tabla: `polynomial_adjustments`

```sql
id
formula_id
valuation_id
adjustment_month
adjustment_year
k_raw
k_rounded
original_amount
adjusted_amount
adjustment_amount
created_at
updated_at
```

---

### 8.6 Tabla: `polynomial_adjustment_terms`

```sql
id
adjustment_id
formula_term_id
coefficient
base_index_value
adjustment_index_value
index_ratio
partial_value
created_at
updated_at
```

---

## 9. Algoritmo para generar fórmula automáticamente

### 9.1 Pseudocódigo

```pseudo
function generatePolynomialFormula(budgetId):
    budget = getBudget(budgetId)
    items = getBudgetItemsWithAPU(budgetId)

    totals = {
        labor: 0,
        materials: 0,
        equipment: 0,
        others: 0,
        general_expenses_profit: 0
    }

    for item in items:
        metrado = item.quantity
        apu = item.apu

        totals.labor += apu.labor_unit_cost * metrado
        totals.materials += apu.materials_unit_cost * metrado
        totals.equipment += apu.equipment_unit_cost * metrado
        totals.others += apu.others_unit_cost * metrado

    totals.general_expenses_profit = budget.general_expenses + budget.profit

    totalBase = sum(totals)

    terms = []

    for group, amount in totals:
        coefficient = amount / totalBase

        terms.append({
            name: group,
            amount: amount,
            coefficient: round(coefficient, 3)
        })

    validateTerms(terms)

    return {
        budget_id: budgetId,
        total_base: totalBase,
        terms: terms,
        formula_text: buildFormulaText(terms)
    }
```

---

## 10. Algoritmo para calcular K

### 10.1 Pseudocódigo

```pseudo
function calculateK(formulaId, adjustmentMonth, adjustmentYear):
    formula = getFormula(formulaId)
    terms = getFormulaTerms(formulaId)

    kRaw = 0
    calculationRows = []

    for term in terms:
        baseIndex = term.base_index_value
        adjustmentIndex = getIndexValue(term.base_index_code, adjustmentMonth, adjustmentYear)

        if baseIndex <= 0:
            throw Error("Base index must be greater than zero")

        ratio = adjustmentIndex / baseIndex
        partial = term.coefficient * ratio
        kRaw += partial

        calculationRows.append({
            term_name: term.term_name,
            coefficient: term.coefficient,
            base_index: baseIndex,
            adjustment_index: adjustmentIndex,
            ratio: ratio,
            partial: partial
        })

    kRounded = round(kRaw, 3)

    return {
        k_raw: kRaw,
        k_rounded: kRounded,
        rows: calculationRows
    }
```

---

## 11. Algoritmo para aplicar reajuste

```pseudo
function applyPolynomialAdjustment(valuationId, formulaId, month, year):
    valuation = getValuation(valuationId)
    kResult = calculateK(formulaId, month, year)

    originalAmount = valuation.amount
    adjustedAmount = originalAmount * kResult.k_rounded
    adjustmentAmount = adjustedAmount - originalAmount

    saveAdjustment({
        valuation_id: valuationId,
        formula_id: formulaId,
        month: month,
        year: year,
        k_raw: kResult.k_raw,
        k_rounded: kResult.k_rounded,
        original_amount: originalAmount,
        adjusted_amount: adjustedAmount,
        adjustment_amount: adjustmentAmount
    })

    return {
        original_amount: originalAmount,
        k: kResult.k_rounded,
        adjusted_amount: adjustedAmount,
        adjustment_amount: adjustmentAmount
    }
```

---

## 12. Validaciones técnicas

### 12.1 Validación de suma de coeficientes

```js
function validateCoefficientSum(terms) {
  const sum = terms.reduce((acc, term) => acc + term.coefficient, 0);
  return Math.abs(sum - 1.0) <= 0.001;
}
```

---

### 12.2 Validación de número máximo de monomios

```js
function validateMaxTerms(terms) {
  return terms.length <= 8;
}
```

---

### 12.3 Validación de coeficiente mínimo

```js
function validateMinimumCoefficient(term) {
  return term.coefficient >= 0.05;
}
```

---

### 12.4 Validación de índice base

```js
function validateBaseIndex(term) {
  return term.base_index_value && term.base_index_value > 0;
}
```

---

### 12.5 Validación de índice de reajuste

```js
function validateAdjustmentIndex(indexValue) {
  return indexValue && indexValue > 0;
}
```

---

## 13. UI sugerida

## Pantalla 1: Generar fórmula polinómica

Elementos:

- Selector de proyecto
- Selector de presupuesto
- Mes base
- Botón: `Generar fórmula polinómica`
- Tabla preliminar de monomios

Columnas:

| Monomio | Grupo | Monto | Coeficiente | Índice base | Estado |
|---|---|---:|---:|---|---|

Acciones:

- Editar monomio
- Agrupar monomio
- Asignar índice
- Recalcular

---

## Pantalla 2: Validación de fórmula

Mostrar:

- Suma de coeficientes
- Número de monomios
- Advertencias por coeficientes menores a `0.05`
- Monomios sin índice asignado
- Estado general: válida / requiere revisión

---

## Pantalla 3: Cálculo de K

Inputs:

- Fórmula polinómica
- Mes de valorización
- Año de valorización
- Índices de reajuste

Tabla:

| Monomio | Coeficiente | Índice base | Índice reajuste | Relación | Parcial |
|---|---:|---:|---:|---:|---:|

Resultado:

```txt
K sin redondear
K redondeado al milésimo
```

---

## Pantalla 4: Aplicar reajuste

Inputs:

- Valorización original
- K calculado

Outputs:

- Monto original
- Monto reajustado
- Reajuste

---

## 14. Ejemplo completo

### Presupuesto base

```txt
MO_total = 180,000.00
MAT_total = 520,000.00
EQ_total = 70,000.00
V_total = 30,000.00
GU_total = 200,000.00
```

```txt
Total_base = 1,000,000.00
```

### Coeficientes

```txt
a = 180,000 / 1,000,000 = 0.180
b = 520,000 / 1,000,000 = 0.520
c = 70,000 / 1,000,000 = 0.070
d = 30,000 / 1,000,000 = 0.030
e = 200,000 / 1,000,000 = 0.200
```

### Fórmula

```txt
K = 0.180(Jr/Jo) + 0.520(Mr/Mo) + 0.070(Er/Eo) + 0.030(Vr/Vo) + 0.200(GUr/GUo)
```

### Índices

| Grupo | Coeficiente | Índice base | Índice reajuste | Relación | Parcial |
|---|---:|---:|---:|---:|---:|
| Mano de obra | 0.180 | 100 | 108 | 1.080 | 0.1944 |
| Materiales | 0.520 | 100 | 115 | 1.150 | 0.5980 |
| Equipo | 0.070 | 100 | 105 | 1.050 | 0.0735 |
| Varios | 0.030 | 100 | 102 | 1.020 | 0.0306 |
| GG + Utilidad | 0.200 | 100 | 110 | 1.100 | 0.2200 |

```txt
K = 1.1165
K redondeado = 1.117
```

### Aplicación

```txt
Valorizacion_original = 100,000.00
K = 1.117

Valorizacion_reajustada = 100,000.00 × 1.117 = 111,700.00
Reajuste = 111,700.00 - 100,000.00 = 11,700.00
```

---

## 15. Prompt sugerido para Codex

Usa este prompt dentro de Codex para implementar la funcionalidad inicial.

```txt
Quiero agregar a mi web app de presupuestos de obra una funcionalidad para calcular fórmulas polinómicas de reajuste de precios según la metodología usada en Perú para presupuestos de construcción.

Lee este archivo Markdown completo y úsalo como especificación funcional y técnica.

Objetivo del MVP:
1. Crear una entidad FormulaPolinomica asociada a un presupuesto.
2. Leer las partidas del presupuesto y sus APU.
3. Agrupar costos por mano de obra, materiales, equipos, otros, gastos generales y utilidad.
4. Calcular coeficientes de incidencia.
5. Validar que la suma de coeficientes sea 1.000 con tolerancia de ±0.001.
6. Validar máximo 8 monomios.
7. Alertar si algún coeficiente es menor a 0.05.
8. Permitir asignar índice base e índice de reajuste a cada monomio.
9. Calcular K usando: K = Σ(coeficiente_i × indice_reajuste_i / indice_base_i).
10. Redondear K al milésimo.
11. Aplicar K a una valorización.
12. Mostrar tabla de cálculo con coeficiente, índice base, índice reajuste, relación y parcial.
13. Generar una vista de reporte simple.

Primero revisa la estructura actual del proyecto y propón los archivos que se deben crear o modificar. Luego implementa el MVP de forma incremental, priorizando lógica de negocio, validaciones, UI básica y pruebas.
```

---

## 16. Criterios de aceptación del MVP

La funcionalidad se considera aceptada cuando:

1. El usuario puede generar una fórmula desde un presupuesto existente.
2. El sistema calcula correctamente los montos agrupados por naturaleza.
3. El sistema calcula coeficientes cuya suma es `1.000`.
4. El sistema muestra advertencias cuando hay más de `8` monomios.
5. El sistema muestra advertencias cuando un coeficiente es menor a `0.05`.
6. El usuario puede ingresar índices base y reajuste.
7. El sistema calcula correctamente `K`.
8. El sistema redondea `K` al milésimo.
9. El sistema aplica `K` sobre una valorización.
10. El sistema muestra un reporte entendible y exportable.

---

## 17. Nota técnica final

Esta funcionalidad debe tratarse como un módulo especializado dentro del sistema de presupuestos.

El cálculo de la fórmula polinómica depende directamente de la calidad de:

- Los metrados
- Los APU
- La clasificación de recursos
- La selección correcta de índices
- El mes base
- El mes de valorización

Por eso, la aplicación debe permitir al usuario revisar, editar y validar la fórmula antes de aplicarla a valorizaciones reales.
