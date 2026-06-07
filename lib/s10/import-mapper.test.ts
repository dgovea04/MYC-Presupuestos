import { describe, expect, it } from "vitest";
import { createMycImportDraftFromS10, normalizeS10Unit, type S10ExportSnapshot } from "@/lib/s10/import-mapper";

const fixture: S10ExportSnapshot = {
  presupuestos: [
    {
      CodPresupuesto: "0201003",
      Descripcion: "CARRETERA ALTO CHICAMA - HUAMACHUCO",
      Moneda: "S/.",
      CostoOferta1: 1250.75,
    },
  ],
  subpresupuestos: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Descripcion: "OBRAS PRELIMINARES",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "999",
      Descripcion: "REGISTRO INTERNO S10",
    },
  ],
  partidas: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "010101",
      Descripcion: "TRAZO Y REPLANTEO",
      CodUnidad: "201",
      Precio1: 37.08,
      RendimientoMO: 100,
      RendimientoEQ: 0,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "010102",
      Descripcion: "LIMPIEZA DE TERRENO",
      CodUnidad: "501",
      Precio1: 150,
      RendimientoMO: 0,
      RendimientoEQ: 80,
    },
  ],
  subpresupuestoDetalles: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Item: "01.01",
      Orden: "0001",
      Secuencial: 1,
      CodPartida: "010101",
      CodPresupuestoPartida: "0201003",
      Descripcion: "TRAZO Y REPLANTEO",
      Unidad: "m",
      Metrado: 2,
      Precio1: 37.08,
      Parcial1: 74.16,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Item: "01.02",
      Orden: "0002",
      Secuencial: 1,
      CodPartida: "010102",
      CodPresupuestoPartida: "0201003",
      Descripcion: "LIMPIEZA DE TERRENO",
      Unidad: "m2",
      Metrado: 3.5,
      Precio1: 150,
      Parcial1: 525,
    },
  ],
  apuDetalles: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "010101",
      CodInsumo: "0147010001",
      Descripcion: "OPERARIO",
      CodUnidad: "906",
      CodIndiceUnificado: "47",
      Cantidad: 2,
      Precio1: 18,
      Parcial1: 36,
      Tipo: "MO",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "010101",
      CodInsumo: "3701010001",
      Descripcion: "HERRAMIENTAS MANUALES",
      CodUnidad: "707",
      CodIndiceUnificado: "37",
      Cantidad: 3,
      Precio1: 0,
      Parcial1: 0,
      Tipo: "HE",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "010102",
      CodInsumo: "3901010001",
      Descripcion: "RETROEXCAVADORA",
      CodUnidad: "907",
      CodIndiceUnificado: "49",
      Cantidad: 1.25,
      Precio1: 120,
      Parcial1: 150,
      Tipo: "EQ",
    },
  ],
};

describe("createMycImportDraftFromS10", () => {
  it("maps an S10 export snapshot into MYC budget and APU draft records", () => {
    const draft = createMycImportDraftFromS10(fixture, {
      companyId: "company-1",
      projectId: "project-1",
    });

    expect(draft.source).toBe("S10");
    expect(draft.project.name).toBe("CARRETERA ALTO CHICAMA - HUAMACHUCO");
    expect(draft.resources).toHaveLength(3);
    expect(draft.resources.map((resource) => [resource.code, resource.category, resource.unit])).toEqual([
      ["0147010001", "LABOR", "hh"],
      ["3701010001", "TOOLS", "%MO"],
      ["3901010001", "EQUIPMENT", "hm"],
    ]);

    expect(draft.budgets).toHaveLength(2);
    expect(draft.budgets[0]?.kind).toBe("GENERAL");
    expect(draft.budgets[0]?.totalDirectCost).toBe(599.16);

    const subBudget = draft.budgets[1];
    expect(subBudget?.kind).toBe("SUB_BUDGET");
    expect(subBudget?.items).toHaveLength(2);
    expect(subBudget?.items.map((item) => [item.code, item.unit, item.quantity, item.partial])).toEqual([
      ["01.01", "m", 2, 74.16],
      ["01.02", "m2", 3.5, 525],
    ]);
    expect(draft.warnings).not.toContain(
      "No se encontraron metrados directos de partida en el snapshot S10; se uso cantidad 1 en cada item importado.",
    );

    const firstApu = subBudget?.items[0]?.apu;
    expect(firstApu?.performance).toBe(100);
    expect(firstApu?.resources.map((row) => [row.resourceId, row.resourceType, row.unit])).toEqual([
      ["s10-resource-0147010001", "LABOR", "hh"],
      ["s10-resource-3701010001", "TOOLS", "%MO"],
    ]);
  });

  it("imports S10 footer rows and derives rates from ResultadoPieSubpresupuesto", () => {
    const draft = createMycImportDraftFromS10({
      ...fixture,
      presupuestos: [{ ...fixture.presupuestos[0], CostoOferta1: 856.8 }],
      pieSubpresupuestos: [
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "01",
          Descripcion: "COSTO DIRECTO",
          Variable: "NDIRECTO",
          Formula: "NDIRECTO",
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "02",
          Descripcion: "GASTOS GENERALES (12.5%)",
          Variable: "GG",
          Formula: "nDirecto*0.125",
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "03",
          Descripcion: "UTILIDAD (7.5%)",
          Variable: "UTI",
          Formula: "nDirecto*0.075",
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "05",
          Descripcion: "SUBTOTAL",
          Variable: "ST",
          Formula: "nDirecto+GG+UTI",
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "06",
          Descripcion: "IGV (19%)",
          Variable: "IGV",
          Formula: "ST*0.19",
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "08",
          Descripcion: "TOTAL PRESUPUESTO",
          Variable: "P_T",
          Formula: "ST+IGV",
        },
      ],
      resultadoPieSubpresupuestos: [
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "01",
          Descripcion: "COSTO DIRECTO",
          Valor1: 600,
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "02",
          Descripcion: "GASTOS GENERALES (12.5%)",
          Valor1: 75,
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "03",
          Descripcion: "UTILIDAD (7.5%)",
          Valor1: 45,
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "05",
          Descripcion: "SUBTOTAL",
          Valor1: 720,
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "06",
          Descripcion: "IGV (19%)",
          Valor1: 136.8,
        },
        {
          CodPresupuesto: "0201003",
          CodSubpresupuesto: "001",
          Linea: "08",
          Descripcion: "TOTAL PRESUPUESTO",
          Valor1: 856.8,
        },
      ],
    });

    expect(draft.budgets[0]).toMatchObject({
      generalExpensesRate: 0.125,
      utilityRate: 0.075,
      igvRate: 0.19,
    });
    expect(draft.budgets[1]).toMatchObject({
      generalExpensesRate: 0.125,
      utilityRate: 0.075,
      igvRate: 0.19,
    });
    expect(draft.budgetFooterRows.find((entry) => entry.budgetId === draft.budgets[1]?.id)?.rows).toContainEqual(
      expect.objectContaining({
        variable: "GG",
        description: "GASTOS GENERALES (12.5%)",
        formula: null,
        manualValue: 75,
      }),
    );
  });

  it("can select a specific S10 budget code", () => {
    const draft = createMycImportDraftFromS10(
      {
        ...fixture,
        presupuestos: [
          ...fixture.presupuestos,
          {
            CodPresupuesto: "0300001",
            Descripcion: "SEGUNDA OBRA",
            Moneda: "S/.",
            CostoOferta1: 10,
          },
        ],
      },
      { budgetCode: "0300001" },
    );

    expect(draft.sourceBudgetCode).toBe("0300001");
    expect(draft.project.name).toBe("SEGUNDA OBRA");
  });

  it("reports warnings for unknown units and missing direct metrados", () => {
    const draft = createMycImportDraftFromS10({
      ...fixture,
      partidas: [
        {
          ...fixture.partidas[0],
          CodUnidad: "9999",
        },
      ],
      subpresupuestoDetalles: undefined,
      apuDetalles: [],
    });

    expect(draft.budgets[1]?.items[0]?.unit).toBe("9999");
    expect(draft.warnings).toContain("No se encontraron metrados directos de partida en el snapshot S10; se uso cantidad 1 en cada item importado.");
    expect(draft.warnings).toContain("Unidad S10 desconocida: 9999.");
  });

  it("imports S10 manual tools as a labor percentage when S10 stores 3% as 0.03", () => {
    const draft = createMycImportDraftFromS10({
      presupuestos: [
        {
          CodPresupuesto: "0302044",
          Descripcion: "I.E. MARIANO MELGAR - CONSOLIDADO",
          Moneda: "S/.",
          CostoOferta1: 10237.5,
        },
      ],
      subpresupuestos: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Descripcion: "ESTRUCTURAS",
        },
      ],
      partidas: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          Descripcion: "CERCO PROVISIONAL CON TRIPLAY PARA DIVISION DE OBRA EN ETAPAS",
          CodUnidad: "201",
          Precio1: 68.25,
        },
      ],
      subpresupuestoDetalles: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Item: "000000000000209",
          Orden: "01.03",
          Secuencial: 4,
          CodPartida: "900302120202",
          CodPresupuestoPartida: "0302044",
          Descripcion: "CERCO PROVISIONAL CON TRIPLAY PARA DIVISION DE OBRA EN ETAPAS",
          Unidad: "m",
          Metrado: 150,
          Precio1: 68.25,
          Parcial1: 10237.5,
        },
      ],
      apuDetalles: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0147010100",
          Descripcion: "CAPATAZ",
          CodUnidad: "906",
          Cantidad: 0.02,
          Precio1: 14.43,
          Parcial1: 0.2886,
          Tipo: "MO",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0147010101",
          Descripcion: "OFICIAL SOLDADOR",
          CodUnidad: "906",
          Cantidad: 0.2,
          Precio1: 13.12,
          Parcial1: 2.624,
          Tipo: "MO",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0147010103",
          Descripcion: "PEON",
          CodUnidad: "906",
          Cantidad: 0.2,
          Precio1: 10.58,
          Parcial1: 2.116,
          Tipo: "MO",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0202000007",
          Descripcion: "ALAMBRE NEGRO RECOCIDO # 16",
          CodUnidad: "301",
          Cantidad: 0.1,
          Precio1: 2.36,
          Parcial1: 0.236,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0243040005",
          Descripcion: "MADERA TRIPLAY",
          CodUnidad: "903",
          Cantidad: 0.83,
          Precio1: 23.5,
          Parcial1: 19.505,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0243140006",
          Descripcion: "MADERA CACHIMBO EN BRUTO",
          CodUnidad: "507",
          Cantidad: 13.33,
          Precio1: 3.25,
          Parcial1: 43.3225,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302120202",
          CodInsumo: "0337010001",
          Descripcion: "HERRAMIENTAS MANUALES",
          CodUnidad: "707",
          Cantidad: 0.03,
          Precio1: null,
          Parcial1: 0,
          Tipo: "HE",
        },
      ],
    });

    const subBudget = draft.budgets[1];
    const item = subBudget?.items[0];
    const toolsRow = item?.apu?.resources.find((row) => row.description === "HERRAMIENTAS MANUALES");

    expect(item?.apu?.totalUnitCost).toBe(68.25);
    expect(toolsRow?.quantity).toBe(3);
    expect(toolsRow?.unitPrice).toBe(5.03);
    expect(toolsRow?.subtotal).toBe(0.15);
    expect(draft.itemMetadata[0]).toMatchObject({
      apuStatus: "OK",
      calculatedApuUnitPrice: 68.25,
      unitPriceDifference: 0,
    });
    expect(draft.warnings).not.toContain(
      "Algunos APUs S10 no cuadran con el precio unitario del presupuesto; se preservo el PU/metrado/parcial S10 y se omitio el APU en esas partidas.",
    );
  });

  it("uses only the APU variant that matches the subpresupuesto detalle PropioPartida", () => {
    const draft = createMycImportDraftFromS10({
      presupuestos: [
        {
          CodPresupuesto: "0302044",
          Descripcion: "I.E. MARIANO MELGAR - CONSOLIDADO",
          Moneda: "S/.",
          CostoOferta1: 2440.72,
        },
      ],
      subpresupuestos: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Descripcion: "ESTRUCTURAS",
        },
      ],
      partidas: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          Descripcion: "TRAZO Y REPLANTEO PRELIMINAR",
          CodUnidad: "501",
          Precio1: 1.29,
        },
      ],
      subpresupuestoDetalles: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Item: "000000000000380",
          Orden: "02.02",
          Secuencial: 11,
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          Metrado: 1892.03,
          Precio1: 1.29,
          Parcial1: 2440.72,
          Descripcion: "",
        },
      ],
      apuDetalles: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0147000032",
          Descripcion: "TOPOGRAFO",
          CodUnidad: "906",
          Cantidad: 0.0133,
          Precio1: 15,
          Parcial1: 0.1995,
          Tipo: "MO",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0147010100",
          Descripcion: "CAPATAZ",
          CodUnidad: "906",
          Cantidad: 0.0013,
          Precio1: 14.43,
          Parcial1: 0.0188,
          Tipo: "MO",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0147010103",
          Descripcion: "PEON",
          CodUnidad: "906",
          Cantidad: 0.04,
          Precio1: 10.58,
          Parcial1: 0.4232,
          Tipo: "MO",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0229030105",
          Descripcion: "CAL EN BOLSAS DE 10 kg",
          CodUnidad: "901",
          Cantidad: 0.05,
          Precio1: 6.27,
          Parcial1: 0.3135,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0239160011",
          Descripcion: "CORDEL",
          CodUnidad: "201",
          Cantidad: 0.19,
          Precio1: 0.15,
          Parcial1: 0.0285,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0243040000",
          Descripcion: "MADERA TORNILLO",
          CodUnidad: "507",
          Cantidad: 0.02,
          Precio1: 3.9,
          Parcial1: 0.078,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0337010001",
          Descripcion: "HERRAMIENTAS MANUALES",
          CodUnidad: "707",
          Cantidad: 0.03,
          Precio1: null,
          Parcial1: 0,
          Tipo: "HE",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          CodInsumo: "0349880020",
          Descripcion: "ESTACION TOTAL",
          CodUnidad: "907",
          Cantidad: 0.0133,
          Precio1: 16,
          Parcial1: 0.2128,
          Tipo: "EQ",
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900302130101",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "02",
          CodInsumo: "9999999999",
          Descripcion: "VARIANTE QUE NO DEBE IMPORTARSE",
          CodUnidad: "301",
          Cantidad: 10,
          Precio1: 100,
          Parcial1: 1000,
        },
      ],
    });

    const item = draft.budgets[1]?.items[0];
    const resourceDescriptions = item?.apu?.resources.map((row) => row.description);

    expect(item?.apu?.totalUnitCost).toBe(1.29);
    expect(resourceDescriptions).not.toContain("VARIANTE QUE NO DEBE IMPORTARSE");
    expect(draft.itemMetadata[0]).toMatchObject({
      apuStatus: "OK",
      calculatedApuUnitPrice: 1.29,
      unitPriceDifference: 0,
    });
  });

  it("deduplicates shared APU rows when multiple budget items use the same S10 APU", () => {
    const sharedApuRows = [
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0147010100",
        Descripcion: "CAPATAZ",
        CodUnidad: "906",
        Cantidad: 0.1067,
        Precio1: 14.43,
        Parcial1: 1.5397,
        Tipo: "MO",
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0147010101",
        Descripcion: "OFICIAL SOLDADOR",
        CodUnidad: "906",
        Cantidad: 1.0667,
        Precio1: 13.12,
        Parcial1: 13.9951,
        Tipo: "MO",
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0147010102",
        Descripcion: "OFICIAL",
        CodUnidad: "906",
        Cantidad: 1.0667,
        Precio1: 11.7,
        Parcial1: 12.4804,
        Tipo: "MO",
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0147010103",
        Descripcion: "PEON",
        CodUnidad: "906",
        Cantidad: 0.5333,
        Precio1: 10.58,
        Parcial1: 5.6423,
        Tipo: "MO",
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0202000008",
        Descripcion: "ALAMBRE NEGRO RECOCIDO # 8",
        CodUnidad: "301",
        Cantidad: 0.3,
        Precio1: 2.36,
        Parcial1: 0.708,
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0202010022",
        Descripcion: "CLAVOS DIFERENTES MEDIDAS",
        CodUnidad: "301",
        Cantidad: 0.17,
        Precio1: 2.54,
        Parcial1: 0.4318,
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0243040000",
        Descripcion: "MADERA TORNILLO",
        CodUnidad: "507",
        Cantidad: 4.25,
        Precio1: 3.9,
        Parcial1: 16.575,
      },
      {
        CodPresupuesto: "0302044",
        CodSubpresupuesto: "001",
        CodPartida: "900305180201",
        CodPresupuestoPartida: "0302044",
        PropioPartida: "01",
        CodInsumo: "0337010001",
        Descripcion: "HERRAMIENTAS MANUALES",
        CodUnidad: "707",
        Cantidad: 0.03,
        Precio1: null,
        Parcial1: 0,
        Tipo: "HE",
      },
    ];

    const draft = createMycImportDraftFromS10({
      presupuestos: [
        {
          CodPresupuesto: "0302044",
          Descripcion: "I.E. MARIANO MELGAR - CONSOLIDADO",
          Moneda: "S/.",
          CostoOferta1: 82526.3,
        },
      ],
      subpresupuestos: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Descripcion: "ESTRUCTURAS",
        },
      ],
      partidas: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          CodPartida: "900305180201",
          Descripcion: "COLUMNAS.- ENCOFRADO Y DESENCOFRADO",
          CodUnidad: "501",
          Precio1: 52.39,
        },
      ],
      subpresupuestoDetalles: [
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Item: "000000000000293",
          Orden: "06.05.03",
          Secuencial: 95,
          CodPartida: "900305180201",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          Descripcion: "COLUMNAS.- ENCOFRADO Y DESENCOFRADO",
          Metrado: 902.75,
          Precio1: 52.39,
          Parcial1: 47295.07,
        },
        {
          CodPresupuesto: "0302044",
          CodSubpresupuesto: "001",
          Item: "000000000000343",
          Orden: "06.06.02",
          Secuencial: 99,
          CodPartida: "900305180201",
          CodPresupuestoPartida: "0302044",
          PropioPartida: "01",
          Descripcion: "",
          Metrado: 672.48,
          Precio1: 52.39,
          Parcial1: 35231.23,
        },
      ],
      apuDetalles: [...sharedApuRows, ...sharedApuRows],
    });

    const items = draft.budgets[1]?.items ?? [];

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.apu?.resources.length)).toEqual([8, 8]);
    expect(items.map((item) => item.apu?.totalUnitCost)).toEqual([52.39, 52.39]);
    expect(draft.itemMetadata.map((metadata) => metadata.apuStatus)).toEqual(["OK", "OK"]);
  });
});

describe("normalizeS10Unit", () => {
  it("normalizes common S10 unit codes", () => {
    expect(normalizeS10Unit("101")).toBe("u");
    expect(normalizeS10Unit("201")).toBe("m");
    expect(normalizeS10Unit("501")).toBe("m2");
    expect(normalizeS10Unit("601")).toBe("m3");
    expect(normalizeS10Unit("405")).toBe("mes");
    expect(normalizeS10Unit("904")).toBe("punto");
    expect(normalizeS10Unit("906")).toBe("hh");
    expect(normalizeS10Unit("907")).toBe("hm");
    expect(normalizeS10Unit("707")).toBe("%MO");
  });
});
