import type { ProjectAttachmentCategory } from "@/types/project";

export function attachmentCategoryLabel(category: ProjectAttachmentCategory) {
  const map: Record<string, string> = {
    PLANO: "Plano",
    ESPECIFICACION: "Especificación",
    CONTRATO: "Contrato",
    MEMORIA: "Memoria",
    FOTO: "Foto",
    OTRO: "Otro",
  };
  return map[category] ?? category;
}
