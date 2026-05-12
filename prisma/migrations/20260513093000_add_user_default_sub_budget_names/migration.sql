ALTER TABLE "UserSettings"
ADD COLUMN "defaultSubBudgetNames" TEXT[] NOT NULL DEFAULT ARRAY['Estructuras', 'Arquitectura', 'Instalaciones Sanitarias', 'Instalaciones Electricas']::TEXT[];
