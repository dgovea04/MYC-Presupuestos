"use client";

import { useState } from "react";
import { Database, FileSpreadsheet } from "lucide-react";
import { DelphinSqliteImporter } from "@/components/imports/delphin-sqlite-importer";
import { Rw7ImporterPageContent } from "@/components/imports/rw7-importer-page-content";

type CompanyOption = { id: string; name: string };

export function DelphinTabbedImporter({ companies }: { companies: CompanyOption[] }) {
  const [activeTab, setActiveTab] = useState<"dprj" | "sqlite">("dprj");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] p-1">
        <button
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "dprj" ? "bg-[var(--app-surface)] text-[var(--app-text-strong)] shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"}`}
          type="button"
          onClick={() => setActiveTab("dprj")}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Archivo .dprj
        </button>
        <button
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "sqlite" ? "bg-[var(--app-surface)] text-[var(--app-text-strong)] shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"}`}
          type="button"
          onClick={() => setActiveTab("sqlite")}
        >
          <Database className="h-4 w-4" />
          Base de datos SQLite
        </button>
      </div>

      {activeTab === "dprj" ? (
        <Rw7ImporterPageContent
          companies={companies}
          copy={{
            accept: ".dprj",
            draftEndpoint: "/api/imports/delphin/draft",
            importEndpoint: "/api/imports/delphin/import",
            fileLabel: "Proyecto Delphin Express",
            missingFileMessage: "Selecciona el archivo .dprj exportado desde Delphin Express.",
            noCompaniesMessage: "Crea una empresa antes de importar proyectos Delphin.",
            projectLabel: "Delphin Express",
            sourceCodeLabel: "Presupuesto Delphin",
            uploadDescription: "Lee el contenedor DPRJ serializado de Delphin para generar el draft MC.",
          }}
        />
      ) : (
        <DelphinSqliteImporter companies={companies} />
      )}
    </div>
  );
}