import { describe, expect, it } from "vitest";
import { stageS10 } from "./s10";

describe("S10 integration adapter", () => {
  it("stages from the versioned S10 snapshot preview contract", async () => {
    const result = await stageS10({ snapshotJson: JSON.stringify({ presupuestos: [{ CodPresupuesto: "P", Descripcion: "Obra" }], subpresupuestos: [{ CodPresupuesto: "P", CodSubpresupuesto: "001", Descripcion: "General" }], partidas: [{ CodPresupuesto: "P", CodSubpresupuesto: "001", CodPartida: "01", Descripcion: "Concreto", CodUnidad: "m3", Precio1: 10 }], apuDetalles: [] }), sourceName: "s10.json" });
    expect(result.rows[0]?.externalKey).toBe("01");
    expect(result.payloadHash).toBeTruthy();
  });
});
