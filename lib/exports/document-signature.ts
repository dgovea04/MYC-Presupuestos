import type { ReportResponsibleMeta } from "@/types/report-meta";

export type DocumentSignatureProjectMeta = {
  name?: string | null;
  clientName?: string | null;
  location?: string | null;
};

export type DocumentSignatureSummary = {
  document: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
  ];
  responsible: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
  ];
  approverLabel: string;
  responsibleSigner: string;
  responsibleRole: string;
};

export type BudgetCoverSummary = {
  title: string;
  budgetName: string;
  companyName: string;
  projectName: string;
  metadata: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
  ];
  signatureTitle: string;
  signaturePrimary: string;
  signatureSecondary: string;
};

export function buildDocumentSignatureSummary(
  budgetName: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
): DocumentSignatureSummary {
  return {
    document: [
      ["Presupuesto", budgetName],
      ["Proyecto", project?.name ?? "Sin proyecto"],
      ["Cliente", project?.clientName ?? "No definido"],
      ["Ubicacion", project?.location ?? "No definida"],
    ],
    responsible: [
      ["Responsable", responsible?.name ?? "Pendiente"],
      ["Cargo", responsible?.jobTitle ?? "Pendiente"],
      ["Empresa", responsible?.companyName ?? "Pendiente"],
      ["Telefono", responsible?.phone ?? "Pendiente"],
    ],
    approverLabel: project?.clientName ?? "Cliente o aprobador",
    responsibleSigner: responsible?.name ?? "Responsable tecnico",
    responsibleRole: responsible?.jobTitle ?? responsible?.companyName ?? "Cargo pendiente",
  };
}

export function buildApprovalSecondaryLabel(project?: DocumentSignatureProjectMeta) {
  const approver = project?.clientName?.trim();
  if (!approver) {
    return "Pendiente de visto bueno del cliente o entidad";
  }

  return `Visto bueno documentario de ${approver}`;
}

export function buildBudgetCoverSummary(
  budgetName: string,
  currency: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
): BudgetCoverSummary {
  return {
    title: "PRESUPUESTO DE OBRA",
    budgetName,
    companyName: responsible?.companyName ?? "Empresa no definida",
    projectName: project?.name ?? "Sin proyecto",
    metadata: [
      ["Cliente", project?.clientName ?? "No definido"],
      ["Ubicacion", project?.location ?? "No definida"],
      ["Moneda", currency],
      ["Responsable", responsible?.name ?? "Pendiente"],
    ],
    signatureTitle: "Responsable tecnico",
    signaturePrimary: responsible?.name ?? "Responsable tecnico",
    signatureSecondary: responsible?.jobTitle ?? responsible?.companyName ?? "Cargo pendiente",
  };
}
