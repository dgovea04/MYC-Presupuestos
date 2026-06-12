"use client";

import { ArrowUpDown, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatNumber } from "@/lib/utils";
import type { MetradoUnit } from "@/types/metrado";

type SheetRow = {
  id: string;
  name: string;
  templateType: string;
  templateName: string;
  unit: MetradoUnit;
  totalQuantity: number;
  partidaCode: string;
  partidaDescription: string;
  partidaUnit: string;
};

type SortKey = "name" | "templateName" | "totalQuantity" | "partidaCode";

function SortableHeader({
  sortKey: sk,
  label,
  currentSortKey,
  onToggle,
}: {
  sortKey: SortKey;
  label: string;
  currentSortKey: SortKey;
  onToggle: (key: SortKey) => void;
}) {
  const active = currentSortKey === sk;
  return (
    <TH className="cursor-pointer select-none" onClick={() => onToggle(sk)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition",
            active ? "text-blue-600" : "text-slate-300",
          )}
        />
      </span>
    </TH>
  );
}

export function ProjectSummaryClient({ sheets }: { sheets: SheetRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("templateName");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    if (!query.trim()) return sheets;

    const lower = query.toLowerCase();
    return sheets.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.templateName.toLowerCase().includes(lower) ||
        s.partidaCode.toLowerCase().includes(lower) ||
        s.partidaDescription.toLowerCase().includes(lower),
    );
  }, [sheets, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "templateName") cmp = a.templateName.localeCompare(b.templateName);
      else if (sortKey === "partidaCode") cmp = a.partidaCode.localeCompare(b.partidaCode);
      else if (sortKey === "totalQuantity") cmp = a.totalQuantity - b.totalQuantity;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  if (sheets.length === 0) {
    return <p className="text-sm text-slate-500">No hay hojas de metrado en este proyecto.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar por nombre, plantilla o partida..."
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className="h-9 rounded-lg pl-9 text-sm"
        />
      </div>

      <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
        <Table className="min-w-[600px] w-full text-xs">
          <THead className="sticky top-0 z-10 bg-slate-50">
            <TR>
              <SortableHeader sortKey="templateName" label="Plantilla" currentSortKey={sortKey} onToggle={toggleSort} />
              <SortableHeader sortKey="name" label="Nombre" currentSortKey={sortKey} onToggle={toggleSort} />
              <SortableHeader sortKey="partidaCode" label="Partida" currentSortKey={sortKey} onToggle={toggleSort} />
              <TH>Und</TH>
              <SortableHeader sortKey="totalQuantity" label="Total" currentSortKey={sortKey} onToggle={toggleSort} />
              <TH className="w-10" />
            </TR>
          </THead>
          <TBody>
            {sorted.map((sheet) => (
              <TR key={sheet.id} className="hover:bg-slate-50">
                <TD className="font-medium text-slate-900">{sheet.templateName}</TD>
                <TD className="text-slate-700">{sheet.name}</TD>
                <TD>
                  <span className="text-slate-500">{sheet.partidaCode}</span>
                  <span className="ml-1 text-slate-400">{sheet.partidaDescription}</span>
                </TD>
                <TD>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {sheet.unit}
                  </span>
                </TD>
                <TD className="text-right font-semibold tabular-nums text-slate-900">
                  {formatNumber(sheet.totalQuantity, 3)}
                </TD>
                <TD>
                  <a
                    href={`/metrados-avanzados?sheetId=${sheet.id}`}
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                    title="Abrir hoja"
                    aria-label={`Abrir ${sheet.name}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <p className="text-xs text-slate-400">
        {sorted.length} de {sheets.length} hojas
      </p>
    </div>
  );
}
