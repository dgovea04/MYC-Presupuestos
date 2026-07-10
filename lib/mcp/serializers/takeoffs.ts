import { decimalToString } from "@/lib/db/serializers";

export type McpSerializedTakeoffs = {
  sheets: Array<{
    id: string;
    name: string;
    status: string;
    unit: string;
    totalQuantity: string;
    rows: Array<{
      id: string;
      sector: string;
      eje: string;
      nivel: string;
      description: string;
      unit: string;
      formulaKey: string;
      inputs: unknown;
      partial: string;
      groupLabel: string | null;
      sortOrder: number;
    }>;
    partidaLinks: Array<{
      id: string;
      budgetItemId: string;
      lastSentQuantity: string | null;
      sentAt: string | null;
    }>;
  }>;
};

export function serializeTakeoffs(data: {
  sheets: Array<{
    id: string;
    name: string;
    status: string;
    unit: string;
    totalQuantity: string | number;
    rows: Array<{
      id: string;
      sector: string;
      eje: string;
      nivel: string;
      description: string;
      unit: string;
      formulaKey: string;
      inputs: unknown;
      partial: string | number;
      groupLabel: string | null;
      sortOrder: number;
    }>;
    partidaLinks: Array<{
      id: string;
      budgetItemId: string;
      lastSentQuantity: string | number | null;
      sentAt: Date | string | null;
    }>;
  }>;
}): McpSerializedTakeoffs {
  return {
    sheets: data.sheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      status: sheet.status,
      unit: sheet.unit,
      totalQuantity: decimalToString(sheet.totalQuantity),
      rows: sheet.rows.map((row) => ({
        id: row.id,
        sector: row.sector,
        eje: row.eje,
        nivel: row.nivel,
        description: row.description,
        unit: row.unit,
        formulaKey: row.formulaKey,
        inputs: row.inputs,
        partial: decimalToString(row.partial),
        groupLabel: row.groupLabel,
        sortOrder: row.sortOrder,
      })),
      partidaLinks: sheet.partidaLinks.map((link) => ({
        id: link.id,
        budgetItemId: link.budgetItemId,
        lastSentQuantity: link.lastSentQuantity != null ? decimalToString(link.lastSentQuantity) : null,
        sentAt: link.sentAt instanceof Date ? link.sentAt.toISOString() : link.sentAt,
      })),
    })),
  };
}
