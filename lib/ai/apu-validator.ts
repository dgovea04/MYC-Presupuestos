import type { AiApuCatalogProposal } from "@/lib/ai/types";
import type { ResourceRecord } from "@/types/resource";

type ValidateApuCatalogProposalInput = {
  proposal: AiApuCatalogProposal;
  resources: ResourceRecord[];
};

export type ApuCatalogValidationResult = {
  isValid: boolean;
  proposal: AiApuCatalogProposal;
  warnings: string[];
};

const SUSPICIOUS_QUANTITY_LIMIT = 10000;
const LOW_CONFIDENCE_LIMIT = 0.65;

export function validateApuCatalogProposal({
  proposal,
  resources,
}: ValidateApuCatalogProposalInput): ApuCatalogValidationResult {
  const warnings = [...proposal.warnings];
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const seenResourceIds = new Set<string>();

  const normalizedItems = proposal.items.flatMap((item) => {
    const resource = resourcesById.get(item.resource_id);

    if (!resource) {
      warnings.push(`El recurso ${item.resource_id} no existe en el catalogo disponible.`);
      if (item.quantity > SUSPICIOUS_QUANTITY_LIMIT) {
        warnings.push(`La cantidad ${item.quantity} de ${item.name} es sospechosa.`);
      }
      return [];
    }

    if (resource.unit !== item.unit) {
      warnings.push(`La unidad de ${resource.description} debe ser ${resource.unit}, no ${item.unit}.`);
    }

    if (resource.category !== item.type) {
      warnings.push(`La categoria de ${resource.description} debe ser ${resource.category}, no ${item.type}.`);
    }

    if (seenResourceIds.has(item.resource_id)) {
      warnings.push(`El recurso ${resource.description} esta duplicado en la propuesta.`);
    }
    seenResourceIds.add(item.resource_id);

    if (item.quantity > SUSPICIOUS_QUANTITY_LIMIT) {
      warnings.push(`La cantidad ${item.quantity} de ${resource.description} es sospechosa.`);
    }

    return [
      {
        ...item,
        name: resource.description,
        type: resource.category,
        unit: resource.unit,
        requires_review: item.requires_review || resource.unit !== item.unit || resource.category !== item.type,
      },
    ];
  });

  if (proposal.confidence < LOW_CONFIDENCE_LIMIT) {
    warnings.push("La confianza es baja; requiere revision tecnica.");
  }

  if (!proposal.requires_human_review) {
    warnings.push("La propuesta IA debe requerir revision humana antes de guardarse.");
  }

  const uniqueWarnings = [...new Set(warnings)];

  return {
    isValid: uniqueWarnings.length === 0,
    proposal: {
      ...proposal,
      items: normalizedItems,
      warnings: uniqueWarnings,
      requires_human_review: true,
    },
    warnings: uniqueWarnings,
  };
}
