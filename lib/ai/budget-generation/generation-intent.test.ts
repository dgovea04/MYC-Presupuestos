import { describe, expect, it } from "vitest";
import {
  extractBudgetGenerationIntent,
  detectProjectTypes,
  PROJECT_TYPE_SYNONYMS,
  type BudgetGenerationProjectType,
} from "./generation-intent";

// ─── detectProjectTypes ─────────────────────────────────────────────────────

describe("detectProjectTypes", () => {
  it("detects vivienda from 'casa de 2 pisos'", () => {
    const types = detectProjectTypes("casa de 2 pisos concreto armado");
    expect(types).toContain("vivienda");
  });

  it("detects vivienda from 'departamento en lima'", () => {
    const types = detectProjectTypes("departamento en lima 3 dormitorios");
    expect(types).toContain("vivienda");
  });

  it("detects edificio from 'edificio de oficinas'", () => {
    const types = detectProjectTypes("edificio de oficinas corporativas");
    expect(types).toContain("edificio");
  });

  it("detects hospital from 'clinica medica'", () => {
    const types = detectProjectTypes("construccion de clinica medica");
    expect(types).toContain("hospital");
  });

  it("detects colegio from 'escuela primaria'", () => {
    const types = detectProjectTypes("escuela primaria zona rural");
    expect(types).toContain("colegio");
  });

  it("detects carretera from 'pavimentacion de pista'", () => {
    const types = detectProjectTypes("pavimentacion de pista y autopista");
    expect(types).toContain("carretera");
  });

  it("detects industrial from 'galpon industrial'", () => {
    const types = detectProjectTypes("galpon industrial 500m2");
    expect(types).toContain("industrial");
  });

  it("returns empty array for description without known keywords", () => {
    const types = detectProjectTypes("trabajos varios de mantenimiento");
    expect(types).toEqual([]);
  });

  it("uses explicit type when provided", () => {
    const types = detectProjectTypes("construccion nueva", "hospital");
    expect(types).toContain("hospital");
  });

  it("detects multiple types when description has mixed keywords", () => {
    const types = detectProjectTypes("edificio de vivienda y oficinas");
    expect(types).toContain("vivienda");
    expect(types).toContain("edificio");
  });

  it("handles accents in synonyms (habitación → vivienda)", () => {
    const types = detectProjectTypes("construccion de edificio habitacional");
    expect(types).toContain("vivienda");
  });
});

// ─── PROJECT_TYPE_SYNONYMS ──────────────────────────────────────────────────

describe("PROJECT_TYPE_SYNONYMS", () => {
  it("covers all BudgetGenerationProjectType values except 'otro'", () => {
    const typeKeys: BudgetGenerationProjectType[] = [
      "vivienda", "edificio", "colegio", "hospital",
      "carretera", "industrial",
    ];
    for (const key of typeKeys) {
      expect(PROJECT_TYPE_SYNONYMS[key]).toBeDefined();
      expect(PROJECT_TYPE_SYNONYMS[key].length).toBeGreaterThan(0);
    }
  });
});

// ─── extractBudgetGenerationIntent ──────────────────────────────────────────

describe("extractBudgetGenerationIntent", () => {
  // ── projectType ───────────────────────────────────────────────────────────

  describe("projectType extraction", () => {
    it('extracts "vivienda" from casa description', () => {
      const intent = extractBudgetGenerationIntent({
        description: "casa unifamiliar de 2 pisos 120m2 en Lima",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("vivienda");
    });

    it('extracts "edificio" from oficina description', () => {
      const intent = extractBudgetGenerationIntent({
        description: "edificio de oficinas corporativas 10 pisos",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("edificio");
    });

    it('extracts "hospital" from clinica description', () => {
      const intent = extractBudgetGenerationIntent({
        description: "clinica medica especializada 500m2",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("hospital");
    });

    it('extracts "colegio" from escuela description', () => {
      const intent = extractBudgetGenerationIntent({
        description: "escuela primaria con 6 aulas",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("colegio");
    });

    it('extracts "carretera" from pista description', () => {
      const intent = extractBudgetGenerationIntent({
        description: "pavimentacion de pista 3km en zona rural",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("carretera");
    });

    it('extracts "industrial" from fabrica description', () => {
      const intent = extractBudgetGenerationIntent({
        description: "fabrica industrial 1000m2",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("industrial");
    });

    it('returns "otro" when no type is detected', () => {
      const intent = extractBudgetGenerationIntent({
        description: "trabajos varios de mantenimiento general",
        companyId: "company-1",
      });
      expect(intent.projectType).toBe("otro");
    });

    it("uses explicitProjectType when provided", () => {
      const intent = extractBudgetGenerationIntent({
        description: "construccion nueva",
        companyId: "company-1",
        explicitProjectType: "hospital",
      });
      expect(intent.projectType).toBe("hospital");
    });

    it("maps explicitProjectType synonym to canonical type", () => {
      const intent = extractBudgetGenerationIntent({
        description: "proyecto nuevo",
        companyId: "company-1",
        explicitProjectType: "clinica",
      });
      expect(intent.projectType).toBe("hospital");
    });
  });

  // ── areaM2 ────────────────────────────────────────────────────────────────

  describe("areaM2 extraction", () => {
    it("extracts 120 from '120m2'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120m2",
        companyId: "company-1",
      });
      expect(intent.areaM2).toBe(120);
    });

    it("extracts 120 from '120 m2' with space", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120 m2 en Lima",
        companyId: "company-1",
      });
      expect(intent.areaM2).toBe(120);
    });

    it("extracts from '120 metros cuadrados'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120 metros cuadrados",
        companyId: "company-1",
      });
      expect(intent.areaM2).toBe(120);
    });

    it("extracts from '5 ha' and converts to m2", () => {
      const intent = extractBudgetGenerationIntent({
        description: "terreno de 5 ha para vivienda",
        companyId: "company-1",
      });
      expect(intent.areaM2).toBe(50000);
    });

    it("returns null when no area is mentioned", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda en Lima",
        companyId: "company-1",
      });
      expect(intent.areaM2).toBeNull();
    });

    it("handles decimal areas", () => {
      const intent = extractBudgetGenerationIntent({
        description: "departamento de 75 m2",
        companyId: "company-1",
      });
      expect(intent.areaM2).toBe(75);
    });
  });

  // ── floors ────────────────────────────────────────────────────────────────

  describe("floors extraction", () => {
    it("extracts 2 from '2 pisos'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "casa de 2 pisos",
        companyId: "company-1",
      });
      expect(intent.floors).toBe(2);
    });

    it("extracts 5 from '5 niveles'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "edificio de 5 niveles",
        companyId: "company-1",
      });
      expect(intent.floors).toBe(5);
    });

    it("extracts from '3 plantas'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 3 plantas",
        companyId: "company-1",
      });
      expect(intent.floors).toBe(3);
    });

    it("returns null when no floors mentioned", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda unifamiliar moderna",
        companyId: "company-1",
      });
      expect(intent.floors).toBeNull();
    });

    it("handles floors > 10", () => {
      const intent = extractBudgetGenerationIntent({
        description: "edificio de 20 pisos",
        companyId: "company-1",
      });
      expect(intent.floors).toBe(20);
    });
  });

  // ── location ──────────────────────────────────────────────────────────────

  describe("location extraction", () => {
    it("extracts Lima from description mentioning Lima", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda en Lima 120m2",
        companyId: "company-1",
      });
      expect(intent.location).toBe("Lima");
    });

    it("extracts Arequipa from description", () => {
      const intent = extractBudgetGenerationIntent({
        description: "colegio en Arequipa 500m2",
        companyId: "company-1",
      });
      expect(intent.location).toBe("Arequipa");
    });

    it("extracts Cusco from description", () => {
      const intent = extractBudgetGenerationIntent({
        description: "hotel en Cusco centro historico",
        companyId: "company-1",
      });
      expect(intent.location).toBe("Cusco");
    });

    it("extracts Trujillo from description", () => {
      const intent = extractBudgetGenerationIntent({
        description: "edificio en Trujillo",
        companyId: "company-1",
      });
      expect(intent.location).toBe("Trujillo");
    });

    it("extracts Miraflores as Lima", () => {
      const intent = extractBudgetGenerationIntent({
        description: "departamento en Miraflores",
        companyId: "company-1",
      });
      expect(intent.location).toBe("Lima");
    });

    it("extracts San Isidro as Lima", () => {
      const intent = extractBudgetGenerationIntent({
        description: "oficina en San Isidro",
        companyId: "company-1",
      });
      expect(intent.location).toBe("Lima");
    });

    it("returns null when no location mentioned", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120m2",
        companyId: "company-1",
      });
      expect(intent.location).toBeNull();
    });

    it("returns null for unknown city", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda en Tarapoto",
        companyId: "company-1",
      });
      expect(intent.location).toBeNull();
    });
  });

  // ── currency ──────────────────────────────────────────────────────────────

  describe("currency extraction", () => {
    it("defaults to PEN for descriptions without currency mention", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120m2",
        companyId: "company-1",
      });
      expect(intent.currency).toBe("PEN");
    });

    it("detects USD when 'USD' is mentioned", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda en USD 200,000",
        companyId: "company-1",
      });
      expect(intent.currency).toBe("USD");
    });

    it("detects USD when 'dolares' is mentioned", () => {
      const intent = extractBudgetGenerationIntent({
        description: "presupuesto en dolares americanos",
        companyId: "company-1",
      });
      expect(intent.currency).toBe("USD");
    });

    it("detects PEN explicitly from 'soles'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "presupuesto en soles",
        companyId: "company-1",
      });
      expect(intent.currency).toBe("PEN");
    });
  });

  // ── templateSource ────────────────────────────────────────────────────────

  describe("templateSource", () => {
    it("defaults to 'auto'", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120m2",
        companyId: "company-1",
      });
      expect(intent.templateSource).toBe("auto");
    });

    it("uses explicitTemplateSource when provided", () => {
      const intent = extractBudgetGenerationIntent({
        description: "vivienda de 120m2",
        companyId: "company-1",
        explicitTemplateSource: "mcp",
      });
      expect(intent.templateSource).toBe("mcp");
    });
  });

  // ── Full intent ───────────────────────────────────────────────────────────

  describe("full intent extraction", () => {
    it("extracts all fields from a comprehensive description", () => {
      const intent = extractBudgetGenerationIntent({
        description: "casa unifamiliar de 2 pisos 120m2 en Miraflores Lima presupuesto en USD",
        companyId: "company-1",
        projectId: "project-1",
        explicitTemplateSource: "mcp",
      });

      expect(intent.projectId).toBe("project-1");
      expect(intent.companyId).toBe("company-1");
      expect(intent.projectType).toBe("vivienda");
      expect(intent.areaM2).toBe(120);
      expect(intent.floors).toBe(2);
      expect(intent.location).toBe("Lima");
      expect(intent.currency).toBe("USD");
      expect(intent.templateSource).toBe("mcp");
      expect(intent.previewOnly).toBe(false);
    });

    it("handles minimal description gracefully", () => {
      const intent = extractBudgetGenerationIntent({
        description: "obra nueva",
        companyId: "company-1",
      });

      expect(intent.projectType).toBe("otro");
      expect(intent.areaM2).toBeNull();
      expect(intent.floors).toBeNull();
      expect(intent.location).toBeNull();
      expect(intent.currency).toBe("PEN");
      expect(intent.templateSource).toBe("auto");
    });

    it("handles empty description gracefully", () => {
      const intent = extractBudgetGenerationIntent({
        description: "",
        companyId: "company-1",
      });

      expect(intent.projectType).toBe("otro");
      expect(intent.areaM2).toBeNull();
      expect(intent.floors).toBeNull();
      expect(intent.location).toBeNull();
      expect(intent.currency).toBe("PEN");
    });
  });
});
