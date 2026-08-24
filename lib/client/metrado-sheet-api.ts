import type { MetradoRowRecord, MetradoSheetRecord, MetradoUnit } from "@/types/metrado";

type SheetResponse = { sheet: MetradoSheetRecord };

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el metrado.");
  return payload;
}

export async function saveMetradoSheet(input: {
  sheetId: string;
  name: string;
  unit: MetradoUnit;
  rows: MetradoRowRecord[];
}): Promise<MetradoSheetRecord> {
  await readResponse<SheetResponse>(await fetch(`/api/metrados-avanzados/${input.sheetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name, unit: input.unit }),
  }));

  const payload = await readResponse<SheetResponse>(await fetch(`/api/metrados-avanzados/${input.sheetId}/rows`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: input.rows }),
  }));

  return payload.sheet;
}

export async function setMetradoSheetActive(sheetId: string, isActive: boolean): Promise<MetradoSheetRecord> {
  const payload = await readResponse<SheetResponse>(await fetch(`/api/metrados-avanzados/${sheetId}/active`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  }));
  return payload.sheet;
}
