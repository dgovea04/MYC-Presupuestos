import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { MetradoSheetRecord } from "@/types/metrado";

export function MetradoHistory({
  sheets,
  onReactivate,
}: {
  sheets: MetradoSheetRecord[];
  onReactivate: (sheet: MetradoSheetRecord) => Promise<void>;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--app-text-strong)]">Hojas históricas</h2>
        <p className="text-sm text-[var(--app-text-muted)]">
          Hojas reemplazadas por un metrado manual que puedes reactivar.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--app-border-soft)]">
        <Table>
          <THead>
            <TR>
              <TH>Hoja</TH>
              <TH>Partida</TH>
              <TH className="text-right">Total</TH>
              <TH className="text-right">Acción</TH>
            </TR>
          </THead>
          <TBody>
            {sheets.map((sheet) => (
              <TR key={sheet.id}>
                <TD className="font-medium">{sheet.name}</TD>
                <TD>{sheet.partidaLink?.budgetItemDescription ?? "Sin partida"}</TD>
                <TD className="text-right tabular-nums">{sheet.totalQuantity}</TD>
                <TD className="text-right">
                  <Button type="button" size="sm" variant="outline" onClick={() => void onReactivate(sheet)}>
                    Reactivar
                  </Button>
                </TD>
              </TR>
            ))}
            {sheets.length === 0 ? (
              <TR>
                <TD colSpan={4} className="py-6 text-center text-sm text-[var(--app-text-muted)]">
                  No hay hojas históricas.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </section>
  );
}
