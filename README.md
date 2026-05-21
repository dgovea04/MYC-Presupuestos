# MYC Presupuestos

MVP inicial de una web app SaaS para presupuestos de obra basada en metodología de Análisis de Precios Unitarios (APU) para Perú.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth
- TanStack Table
- Zustand
- ExcelJS
- PDFKit

## Qué incluye este MVP

- Registro e inicio de sesión
- Perfil de empresa o profesional
- Dashboard básico
- CRUD de proyectos
- CRUD base de presupuestos
- Editor de presupuesto con partidas y resumen lateral
- Editor APU por partida
- Catálogo de insumos
- Motor centralizado de cálculos
- Exportación de presupuesto a Excel y PDF
- Exportación de APU a Excel
- Seed con datos demo

## Requisitos

- Node.js 22 o superior
- npm 10 o superior
- PostgreSQL 14 o superior

## 1. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto tomando como base [.env.example](/C:/MYC-Presupuestos/.env.example).

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/myc_presupuestos?schema=public"
AUTH_SECRET="una-clave-segura-y-larga"
NEXTAUTH_URL="http://localhost:3000"
```

## 2. Crear la base de datos

En PostgreSQL crea una base de datos llamada `myc_presupuestos`.

Ejemplo en `psql`:

```sql
CREATE DATABASE myc_presupuestos;
```

## 3. Instalar dependencias

Si todavía no lo hiciste:

```powershell
npm.cmd install
```

## 4. Generar cliente Prisma y migrar

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

## 5. Cargar datos demo

```powershell
npm.cmd run prisma:seed
```

Esto crea:

- Un usuario demo
- Una empresa demo
- Un proyecto demo
- Un presupuesto demo
- Insumos base
- Un APU de ejemplo

## 6. Levantar el proyecto

```powershell
npm.cmd run dev
```

Luego abre:

```text
http://localhost:3000
```

## Acceso demo

Si ejecutaste el seed, puedes entrar con:

```text
Email: demo@mycpresupuestos.pe
Password: Demo12345
```

También puedes crear tu propia cuenta desde `/register`.

## Flujo recomendado para probar el MVP

1. Inicia sesión.
2. Entra a `Projects` y crea una obra.
3. Entra a `Budgets` y crea un presupuesto.
4. Abre el presupuesto.
5. Agrega títulos, subtítulos y partidas.
6. Edita metrados.
7. Abre `Editar APU` para una partida.
8. Ajusta insumos, cantidades y precios.
9. Revisa cómo cambian:
   - costo directo
   - gastos generales
   - utilidad
   - IGV
   - total
10. Exporta:
   - Excel de presupuesto
   - Excel de APU
   - PDF de presupuesto

## Scripts disponibles

mero<!--  -->
mero<!--  -->
```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
```

## Modulo de Formula Polinomica

El proyecto ya incluye un modulo base para Formula Polinomica de obras de edificacion, orientado a normativa peruana y a reajuste de valorizaciones.

Fuentes de referencia usadas en la implementacion:

- `presupuesto-ejemplo/formula-polinomica-peru-webapp-spec.md`
- `presupuesto-ejemplo/formula-polinomica/07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx`

Capacidades actuales:

- generar una formula desde un presupuesto general con APU
- consolidar grupos base `MO`, `MAT`, `EQ`, `V` y `GU`
- validar suma de coeficientes al milésimo
- asignar indices INEI base por monomio
- calcular preview de `K`
- aplicar reajuste a una valorizacion y guardar historial

Rutas principales del modulo:

- `GET/POST/PATCH /api/budgets/[id]/polynomial-formula`
- `POST /api/polynomial-formulas/[id]/calculate`
- `GET/POST /api/polynomial-formulas/[id]/adjustments`
- `GET /api/unified-indices?month=1&year=2026`

Notas importantes:

- La base de la formula polinomica excluye IGV.
- Los indices INEI se cargan desde el seed del proyecto.
- Si cambias la fuente Excel de indices, vuelve a ejecutar:

```powershell
npm.cmd run prisma:seed
```

Verificacion recomendada para este modulo:

```powershell
npm.cmd test -- lib/calculations/polynomial-formula.test.ts lib/data/polynomial-formulas.test.ts
npm.cmd run lint
npm.cmd run build
```

## Estructura principal

```text
/app
  /(auth)
  /dashboard
  /projects
  /budgets
  /resources
  /settings
  /api

/components
  /auth
  /layout
  /budget
  /apu
  /projects
  /resources
  /ui

/lib
  /auth
  /calculations
  /data
  /db
  /exports
  /validations

/prisma
  schema.prisma
  seed.ts

/types
```

## Verificación rápida

Estos comandos ya deberían funcionar sin errores:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Nota:
- `lint` puede mostrar una advertencia no bloqueante relacionada con TanStack Table y React Compiler.

## Limitaciones actuales del MVP

- El editor de presupuesto ya permite guardar estructura y partidas, pero aún no tiene drag-and-drop ni navegación completa tipo spreadsheet.
- El catálogo de insumos ya permite ver, buscar, filtrar y crear insumos, pero todavía no tiene edición/eliminación completa desde UI.
- No se ha implementado todavía OCR, IA, forecasting, BIM ni colaboración avanzada.

## Siguiente iteración sugerida

- Mejorar persistencia detallada del editor de presupuesto
- Agregar edición y eliminación de insumos
- Mejorar jerarquía visual de títulos, subtítulos, partidas y subpartidas
- Incorporar tablas más cercanas a experiencia Excel
- Agregar reportes más detallados y formatos más cercanos a los Excel de referencia
