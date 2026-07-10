import { decimalToString } from "@/lib/db/serializers";

export type McpSerializedWorkSchedule = {
  schedule: {
    items: Array<{
      id: string;
      budgetItemId: string;
      startDate: string;
      endDate: string;
      durationDays: number;
      predecessor: string | null;
      crew: string | null;
      distributions: Array<{
        id: string;
        year: number;
        month: number;
        percentage: string;
      }>;
    }>;
  } | null;
};

export function serializeWorkSchedule(data: {
  items: Array<{
    id: string;
    budgetItemId: string;
    startDate: Date | string;
    endDate: Date | string;
    durationDays: number;
    predecessor: string | null;
    crew: string | number | null;
    distributions: Array<{
      id: string;
      year: number;
      month: number;
      percentage: string | number;
    }>;
  }>;
} | null): McpSerializedWorkSchedule {
  if (!data) return { schedule: null };

  return {
    schedule: {
      items: data.items.map((item) => ({
        id: item.id,
        budgetItemId: item.budgetItemId,
        startDate: item.startDate instanceof Date ? item.startDate.toISOString() : item.startDate,
        endDate: item.endDate instanceof Date ? item.endDate.toISOString() : item.endDate,
        durationDays: item.durationDays,
        predecessor: item.predecessor,
        crew: item.crew != null ? decimalToString(item.crew) : null,
        distributions: item.distributions.map((distribution) => ({
          id: distribution.id,
          year: distribution.year,
          month: distribution.month,
          percentage: decimalToString(distribution.percentage),
        })),
      })),
    },
  };
}
