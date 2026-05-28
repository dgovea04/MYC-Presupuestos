import type {
  MetradoFormulaInputKey,
  MetradoFormulaKey,
  MetradoFormulaRecord,
  MetradoTemplateRecord,
  MetradoTemplateType,
  MetradoUnit,
} from "@/types/metrado";

type TemplateSeed = {
  type: MetradoTemplateType;
  name: string;
  description: string;
  defaultUnit: MetradoUnit;
  formulas: Array<{
    key: MetradoFormulaKey;
    label: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
  }>;
};

const templateSeeds: TemplateSeed[] = [
  {
    type: "CONCRETE",
    name: "Concreto",
    description: "Volumenes de concreto por sector, eje y nivel.",
    defaultUnit: "m3",
    formulas: [
      {
        key: "volume",
        label: "Largo x ancho x alto",
        expression: "largo * ancho * alto",
        requiredInputs: ["largo", "ancho", "alto"],
        resultUnit: "m3",
      },
    ],
  },
  {
    type: "REBAR",
    name: "Acero de refuerzo",
    description: "Peso de acero por cantidad, longitud y peso unitario.",
    defaultUnit: "kg",
    formulas: [
      {
        key: "rebarWeight",
        label: "Cantidad x longitud x peso unitario",
        expression: "cantidad * longitud * pesoUnitario",
        requiredInputs: ["cantidad", "longitud", "pesoUnitario"],
        resultUnit: "kg",
      },
    ],
  },
  {
    type: "FORMWORK",
    name: "Encofrado",
    description: "Area de encofrado por perimetro y altura.",
    defaultUnit: "m2",
    formulas: [
      {
        key: "formworkArea",
        label: "Perimetro x altura",
        expression: "perimetro * altura",
        requiredInputs: ["perimetro", "altura"],
        resultUnit: "m2",
      },
    ],
  },
  {
    type: "MASONRY",
    name: "Albanileria",
    description: "Metrados de muros por area o longitud.",
    defaultUnit: "m2",
    formulas: [
      {
        key: "area",
        label: "Largo x ancho",
        expression: "largo * ancho",
        requiredInputs: ["largo", "ancho"],
        resultUnit: "m2",
      },
    ],
  },
  {
    type: "PLASTER",
    name: "Tarrajeo",
    description: "Areas de tarrajeo por pano y factor.",
    defaultUnit: "m2",
    formulas: [
      {
        key: "factorArea",
        label: "Area x factor",
        expression: "area * factor",
        requiredInputs: ["area", "factor"],
        resultUnit: "m2",
      },
    ],
  },
  {
    type: "PAINT",
    name: "Pintura",
    description: "Areas de pintura con factores de repeticion.",
    defaultUnit: "m2",
    formulas: [
      {
        key: "factorArea",
        label: "Area x factor",
        expression: "area * factor",
        requiredInputs: ["area", "factor"],
        resultUnit: "m2",
      },
    ],
  },
  {
    type: "EXCAVATION",
    name: "Excavacion",
    description: "Volumenes de excavacion.",
    defaultUnit: "m3",
    formulas: [
      {
        key: "volume",
        label: "Largo x ancho x alto",
        expression: "largo * ancho * alto",
        requiredInputs: ["largo", "ancho", "alto"],
        resultUnit: "m3",
      },
    ],
  },
  {
    type: "FLOORING",
    name: "Pisos",
    description: "Areas de piso por ambiente.",
    defaultUnit: "m2",
    formulas: [
      {
        key: "area",
        label: "Largo x ancho",
        expression: "largo * ancho",
        requiredInputs: ["largo", "ancho"],
        resultUnit: "m2",
      },
    ],
  },
  {
    type: "ROOFING",
    name: "Coberturas",
    description: "Areas y longitudes para techos y coberturas.",
    defaultUnit: "m2",
    formulas: [
      {
        key: "factorArea",
        label: "Area x factor",
        expression: "area * factor",
        requiredInputs: ["area", "factor"],
        resultUnit: "m2",
      },
    ],
  },
  {
    type: "CUSTOM",
    name: "Personalizado",
    description: "Metrado manual o formula controlada.",
    defaultUnit: "und",
    formulas: [
      {
        key: "manual",
        label: "Manual",
        expression: "manual",
        requiredInputs: ["manual"],
        resultUnit: "und",
      },
    ],
  },
];

export const metradoTemplates: MetradoTemplateRecord[] = templateSeeds.map(
  (template) => {
    const templateId = `template-${template.type.toLowerCase()}`;
    const formulas: MetradoFormulaRecord[] = template.formulas.map(
      (formula, formulaIndex) => ({
        ...formula,
        id: `${templateId}-formula-${formulaIndex + 1}`,
        templateId,
      }),
    );

    return {
      ...template,
      id: templateId,
      formulaKeys: formulas.map((formula) => formula.key),
      formulas,
    };
  },
);

export function getMetradoTemplateByType(
  value: string,
): MetradoTemplateRecord | null {
  return metradoTemplates.find((template) => template.type === value) ?? null;
}
