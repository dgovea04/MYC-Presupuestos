import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveMetradoSheet } from "@/lib/client/metrado-sheet-api";

const sheet = { id: "sheet-1" } as never;

describe("metrado-sheet-api", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("persists metadata and rows through the shared API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ sheet }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sheet }), { status: 200 }));

    await expect(saveMetradoSheet({ sheetId: "sheet-1", name: "Hoja", unit: "m3", rows: [] })).resolves.toStrictEqual(sheet);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/metrados-avanzados/sheet-1/rows");
  });
});
