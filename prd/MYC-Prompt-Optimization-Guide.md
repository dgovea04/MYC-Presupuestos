# MYC Presupuestos - Optimizacion de Prompts para Khipu y ChatGPT Bridge V2

## Objetivo

Este documento define el contrato implementado para enviar tareas de IA desde MYC Presupuestos hacia Khipu y ChatGPT Bridge V2.

Las reglas estables viven en los prompt builders y en ChatGPT Bridge. La webapp solo envia un `INPUT JSON` limpio con la tarea, el rol, el formato esperado, el contexto necesario y los datos concretos del usuario.

Este contrato reduce tokens, evita reglas duplicadas en cada request y mantiene las reglas criticas fuera del payload dinamico.

## Contrato de INPUT JSON

La webapp debe enviar un objeto JSON compacto y estable. El prompt builder interpreta este objeto y lo combina con las reglas base del sistema.

Ejemplo para generacion de APU:

```json
{
  "task": "generate_apu",
  "role": "construction_cost_assistant_peru",
  "output": {
    "format": "json_only",
    "schema": "apu_generation_v1"
  },
  "context": {
    "project": "Edificio multifamiliar",
    "selectedItem": "Excavacion para calzaduras",
    "unit": "m3",
    "currentCost": 60
  },
  "input": {
    "description": "Generar un APU referencial para excavacion manual en terreno normal",
    "unit": "m3"
  },
  "guardrails": {
    "humanReviewRequired": true,
    "noAutomaticBudgetMutation": true,
    "noExactPriceFabrication": true
  }
}
```

## Tabla de Tareas

| Caso | task | output.format | output.schema |
| --- | --- | --- | --- |
| chat | technical_chat | text | technical_chat_v1 |
| apu | generate_apu | json_only | apu_generation_v1 |
| review | review_budget | json_only | budget_review_v1 |
| autocomplete | autocomplete_construction_text | text | autocomplete_text_v1 |

## Reglas Base de Prompt

Los prompt builders y ChatGPT Bridge son responsables de aplicar las reglas permanentes:

- Usar el rol tecnico definido para presupuestos de construccion en Peru.
- Respetar el tipo de tarea indicado en `task`.
- Responder en el formato declarado por `output.format`.
- Cuando `output.format` sea `json_only`, devolver solo JSON valido.
- Aplicar el schema declarado por `output.schema`.
- Tratar precios, rendimientos, metrados y costos como datos para revision humana.
- Declarar supuestos o datos faltantes cuando no haya informacion suficiente.
- Mantener las recomendaciones como apoyo tecnico, no como aprobacion automatica.

## Restricciones

- No enviar `projectId` a ChatGPT Bridge.
- No incluir reglas largas dentro del JSON enviado por la webapp.
- No cambiar formulas ni calculos financieros desde este contrato.
- No modificar la logica de formula polinomica, costos, decimales o precision financiera.
- La salida estructurada sigue siendo validada en backend antes de usarse en la aplicacion.
- La webapp debe mantener el payload enfocado en datos de entrada, contexto minimo y formato esperado.

## Validacion Backend

El contrato de prompts no reemplaza la validacion del backend.

Toda respuesta estructurada debe validarse antes de persistirse, renderizarse como dato confiable o usarse para actualizar presupuestos, APUs, partidas, recursos, metrados o reportes.

La IA puede sugerir, completar o revisar contenido, pero los cambios que afecten calculos o documentos tecnicos deben pasar por las reglas existentes de dominio y revision humana.
