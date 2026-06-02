import { describe, expect, it } from "vitest";

import { resolveCurrentResourceIu } from "@/lib/resources/current-iu-assignment";
import type { ResourceCategory } from "@/types/resource";

const unifiedIndices = [
  { code: "1", name: "ACEITE Y LUBRICANTE" },
  { code: "2", name: "ACERO DE CONSTRUCCION LISO" },
  { code: "3", name: "ACERO DE CONSTRUCCION CORRUGADO" },
  { code: "4", name: "AGREGADO FINO" },
  { code: "5", name: "AGREGADO GRUESO" },
  { code: "7", name: "ALAMBRE Y CABLE TIPO TW, THW, LSOH" },
  { code: "17", name: "BLOQUES Y LADRILLOS" },
  { code: "21", name: "CEMENTO PORTLAND E HIDRAULICO" },
  { code: "24", name: "CERAMICA Y PORCELANATO" },
  { code: "32", name: "FLETE TERRESTRE" },
  { code: "48", name: "MAQUINARIA Y EQUIPO DE CONSTRUCCION LIVIANO" },
  { code: "43", name: "MADERA NACIONAL PARA ENCOFRADO Y CARPINTERIA" },
  { code: "47", name: "MANO DE OBRA (INCLUYE LEYES SOCIALES)" },
  { code: "65", name: "TUBERIA DE ACERO NEGRO Y/O GALVANIZADO" },
  { code: "72", name: "TUBERIA DE PVC PARA REDES INTERIORES" },
  { code: "80", name: "CONCRETO PREMEZCLADO" },
];

function resolve(description: string, category: ResourceCategory = "MATERIAL", legacyIu?: string | null) {
  return resolveCurrentResourceIu({
    description,
    category,
    legacyIu,
    unifiedIndices,
    dictionaryRows: [
      { code: "21", element: "Cemento Portland tipo I", note: null },
      { code: "17", element: "Ladrillo king kong", note: null },
    ],
  });
}

describe("resolveCurrentResourceIu", () => {
  it("assigns critical polynomial formula families from resource descriptions", () => {
    expect(resolve("OPERARIO", "LABOR")).toBe("47");
    expect(resolve("ACERO CORRUGADO F'Y 4,200 KG/CM2")).toBe("03");
    expect(resolve("ACERO DE REFUERZO F´Y = 4200 KG/CM2")).toBe("03");
    expect(resolve("ACERO LISO REDONDO")).toBe("02");
    expect(resolve("ALAMBRE DE ACERO N 8")).toBe("02");
    expect(resolve("ALAMBRE THW N 12")).toBe("07");
    expect(resolve("ALAMBRE TW N 14")).toBe("07");
    expect(resolve("CABLE LSOH 2.5MM2")).toBe("07");
    expect(resolve("BALDOSA I 30X30 AGATA PIEDRA")).toBe("24");
    expect(resolve("CERAMICO IMPORTADO DE 30 x 30cm")).toBe("24");
    expect(resolve("PORCELANATO DE 30 x 30cm")).toBe("24");
    expect(resolve("ARENA GRUESA")).toBe("05");
    expect(resolve("ARENA ZARANDEADA")).toBe("04");
    expect(resolve("PIEDRA CHANCADA 1/2\"")).toBe("05");
    expect(resolve("MADERA TORNILLO PARA ENCOFRADO")).toBe("43");
    expect(resolve("LUBRICANTES Y FILTROS")).toBe("01");
    expect(resolve("PRODUCCION CONCRETO CLASE C (F'C=280 KG/CM2)")).toBe("80");
    expect(resolve("TUBO PVC ELECTRICO SAP 1/2 X 3M")).toBe("72");
    expect(resolve("CODO FIERRO GALVANIZADO 1/2")).toBe("65");
    expect(resolve("COMPACTADOR VIBRATORIO TIPO PLANCHA 7 HP", "EQUIPMENT")).toBe("48");
    expect(resolve("MOVILIZACION Y DESMOVILIZACION DE EQUIPOS", "EQUIPMENT")).toBe("32");
  });

  it("uses dictionary rows when manual rules are not enough", () => {
    expect(resolve("CEMENTO PORTLAND TIPO I (42.5KG)", "MATERIAL", "39")).toBe("21");
    expect(resolve("LADRILLO KING KONG 18 HUECOS", "MATERIAL", "39")).toBe("17");
  });

  it("falls back to the legacy IU only when it is still an official current code", () => {
    expect(resolve("INSUMO GENERICO", "MATERIAL", "21")).toBe("21");
    expect(resolve("INSUMO GENERICO", "MATERIAL", "99")).toBeNull();
  });
});
