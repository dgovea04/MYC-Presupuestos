export function projectCategoryLabel(category: string | null | undefined) {
  const map: Record<string, string> = {
    EDIFICACION: "Edificación",
    INFRAESTRUCTURA_VIAL: "Infraestructura Vial",
    SANEAMIENTO: "Saneamiento",
    ELECTRICO: "Eléctrico / Electromecánico",
    MINERO: "Minería",
    INDUSTRIAL: "Industrial",
    HABILITACION_URBANA: "Habilitación Urbana",
    OTRO: "Otro",
  };
  return category ? (map[category] ?? category) : null;
}

export function buildingSubtypeLabel(subtype: string | null | undefined) {
  const map: Record<string, string> = {
    UNIFAMILIAR: "Unifamiliar",
    MULTIFAMILIAR: "Multifamiliar",
    COMERCIAL: "Comercial",
    OFICINAS: "Oficinas",
    EDUCACIONAL: "Educacional",
    HOSPITALARIO: "Hospitalario",
    HOTELERO: "Hotelero",
    MIXTO: "Mixto",
    OTRO: "Otro",
  };
  return subtype ? (map[subtype] ?? subtype) : null;
}

export function contractTypeLabel(contractType: string | null | undefined) {
  const map: Record<string, string> = {
    SUMA_ALZADA: "Suma Alzada",
    PRECIOS_UNITARIOS: "Precios Unitarios",
    MIXTO: "Mixto",
    ADMINISTRACION: "Administración",
  };
  return contractType ? (map[contractType] ?? contractType) : null;
}
