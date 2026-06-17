# MYC Presupuestos

MYC Presupuestos es una plataforma SaaS moderna para costos, presupuestos y control tecnico de obras en Peru, basada en Analisis de Precios Unitarios (APU), presupuestos jerarquicos, formula polinomica, metrados, cronograma, riesgo y exportaciones profesionales.

La aplicacion esta orientada a ingenieros, contratistas, oficinas tecnicas y empresas constructoras que necesitan preparar, revisar y controlar presupuestos de obra con precision financiera.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth
- TanStack Table
- Zustand
- decimal.js
- ExcelJS
- PDFKit
- Recharts
- Stripe
- Ollama para IA local

## Funcionalidades actuales

### Plataforma y cuenta

- Registro e inicio de sesion.
- Perfil de usuario con avatar, telefono, cargo y bio profesional.
- Perfil de empresa con RUC, logo y datos para reportes.
- Configuracion de moneda, decimales, formato de fecha, tasas por defecto y subpresupuestos iniciales.
- Planes Starter, Pro y Empresa con limites, entitlements y estado de facturacion.

### Dashboard operativo

- KPIs de proyectos activos, pendientes, reajustes del mes y valor total de presupuestos.
- Bandeja de pendientes por prioridad.
- Separacion entre acciones operativas y notas creadas por el usuario.
- Actividad reciente por proyecto, presupuesto, formula y reajustes.
- Accesos rapidos para crear proyectos, presupuestos y revisar configuracion.

### Proyectos y presupuestos

- CRUD de proyectos u obras.
- Duplicacion de proyectos.
- Presupuesto general consolidado.
- Subpresupuestos por especialidad.
- Editor de presupuesto con estructura jerarquica, partidas, metrados y resumen.
- Modo de visualizacion moderno y modo tipo Excel.
- Importacion por pegado desde Excel para estructura basica de partidas.
- Motor centralizado de calculos para costo directo, gastos generales, utilidad, IGV y total.

### APU y catalogos

- Catalogo de insumos con busqueda, filtros, creacion, edicion y eliminacion via API/UI disponible.
- Catalogo de partidas con rendimiento, unidad, precio y filas APU.
- Editor APU por partida.
- Aplicacion de partidas desde catalogo hacia presupuestos.
- Generador de partidas por similitud con trazabilidad de fuentes, insumos sugeridos y revision manual.

### Formula polinomica e indices

- Generacion de formula desde presupuesto general o subpresupuestos.
- Consolidacion de monomios y componentes desde APUs.
- Coeficientes con precision de 3 decimales.
- Validacion de suma de coeficientes, indices base y valores de reajuste.
- Diccionario de indices unificados e indices por periodo.
- Calculo preview de `K`.
- Registro de valorizaciones reajustadas e historial de ajustes.

### Gastos generales, pie y reportes

- Estructura editable de gastos generales fijos y variables.
- Items con cantidades, participacion, precios y categorias.
- Pie de presupuesto con variables, formulas, valores manuales, IU y resaltados.
- Firma/documento con datos de responsable y empresa.
- Panel centralizado de exportacion con presets, PDF, Excel, CSV o ZIP segun modulo.

### Metrados avanzados

- Hojas persistentes de metrados.
- Plantillas para concreto, acero, encofrado, albanileria, tarrajeo, pintura, excavacion, pisos, techos y personalizados.
- Motor de formulas aislado de la UI.
- Validaciones por fila y hoja.
- Importacion/exportacion Excel.
- Formulas personalizadas por usuario.
- Envio de cantidades calculadas a partidas de presupuesto.

### Cronograma y control temporal

- Programacion de obra por partidas.
- Fechas, duraciones, predecesores y cuadrillas.
- Distribucion por periodos.
- Calendario valorizado.
- Calendario de insumos.
- Curva S basica.
- Ruta critica y validaciones de cronograma.

### Riesgo Monte Carlo

- Analisis probabilistico por presupuesto.
- Variables de cantidad por partida.
- Distribucion triangular: minimo, mas probable y maximo.
- Simulacion en worker del navegador.
- Percentiles P10, P50, P80, P90 y P95.
- Histograma, curva acumulada y KPIs estadisticos.
- Persistencia de variables y resumen de corridas.

### IA (Khipu)

- Workspace de IA (`/ai`) protegido por plan Pro.
- Chat tecnico con streaming.
- Generacion asistida de APU.
- Revision de presupuesto.
- Autocompletado tecnico.
- Proveedores multiples: Ollama local, ChatGPT Bridge, OpenAI API, Gemini API y OpenRouter.
- Proveedor por defecto configurable en `/settings`.
- API keys de OpenAI y Gemini encriptadas con AES-256-GCM.
- Panel "Proveedores Cloud IA" en Configuracion para gestionar keys, testear conexion y elegir modelo.
- Rate limiting (3 intentos cada 5 minutos) en el endpoint de test de API keys.
- Seleccion de proveedor en el workspace con indicadores de estado (listo / sin key / con alerta).
- Health check de Ollama con modelos instalados y estado de cloud providers por usuario.
- Control de consumo de tokens por periodo y por accion.
- Administracion de cupos extra desde panel admin.
- Validacion de ENCRYPTION_KEY al iniciar el servidor (warning si no esta configurada).

### Administracion y facturacion

- Panel admin para usuarios, roles, estado, plan y cupos IA.
- Estadisticas de membresias y uso de IA.
- Stripe checkout, portal y webhook.
- Solicitudes manuales por Yape.
- Activacion manual de pagos desde admin.

### Notas operativas

- Drawer contextual de notas.
- Notas asociadas a proyecto, presupuesto, partida o ruta.
- Prioridades alta, media y baja.
- Estado abierto/resuelto.
- Visibilidad en dashboard como pendientes operativos.

## Requisitos

- Node.js 22 o superior
- npm 10 o superior
- PostgreSQL 14 o superior
- Ollama local opcional para funciones de IA

## Configuracion local

### 1. Variables de entorno

Crea un archivo `.env` en la raiz del proyecto tomando como base `.env.example`.

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/myc_presupuestos?schema=public"
AUTH_SECRET="una-clave-segura-y-larga"
NEXTAUTH_URL="http://localhost:3000"

# Opcional: clave dedicada para encriptar API keys de cloud providers (OpenAI/Gemini).
# Si no se configura, se usa AUTH_SECRET como fallback.
ENCRYPTION_KEY="una-clave-dedicada-de-32-bytes"

# Opcional: API keys de entorno para OpenAI, Gemini y OpenRouter (fallback si el usuario no configura las suyas).
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="AIza..."
OPENROUTER_API_KEY="sk-or-..."
OPENROUTER_MODEL="deepseek/deepseek-chat-v3-0324:free"
```

### 2. Crear base de datos

```sql
CREATE DATABASE myc_presupuestos;
```

### 3. Instalar dependencias

```powershell
npm.cmd install
```

### 4. Generar Prisma y migrar

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

### 5. Cargar datos demo

```powershell
npm.cmd run prisma:seed
```

El seed crea usuario demo, empresa, proyecto, presupuesto, insumos, partidas, APUs base, indices y datos iniciales.

### 6. Levantar la app

```powershell
npm.cmd run dev
```

Luego abre:

```text
http://localhost:3000
```

## Importacion desde S10 local

Si el usuario ya tiene S10 y SQL Server Express instalados, no es necesario restaurar un `.S2K` manualmente. Puedes leer una base S10 existente, listar sus presupuestos y exportar un snapshot JSON compatible con el importador MYC.

### 1. Detectar bases S10 candidatas

```powershell
npm.cmd run s10:sqlserver -- --list-databases
```

Por defecto usa `.\SQLEXPRESS` con seguridad integrada de Windows y `Trust server certificate`. Si tu instancia tiene otro nombre:

```powershell
npm.cmd run s10:sqlserver -- --list-databases --server localhost\SQLEXPRESS
```

### 2. Restaurar un respaldo .S2K local

Si tienes un archivo `.S2K` de S10, puedes restaurarlo como una base local de SQL Server Express:

```powershell
npm.cmd run s10:sqlserver -- --restore --backup presupuesto-ejemplo\s10\obra.S2K --database S10_OBRA_MYC
```

El comando valida que el `.S2K` sea un backup SQL Server, ejecuta `RESTORE FILELISTONLY`, mueve los archivos logicos al directorio local de datos/logs de SQL Server y verifica que la base restaurada tenga tablas S10. Si quieres sobrescribir una base existente, agrega `--replace`.

### 3. Ver presupuestos dentro de una base

```powershell
npm.cmd run s10:sqlserver -- --list-budgets --database S10_OBRA_MYC
```

Esto muestra codigos como `0302044` junto con la descripcion del presupuesto.

### 4. Exportar el snapshot JSON

```powershell
npm.cmd run s10:sqlserver -- --export --database S10_OBRA_MYC --budget 0302044 --out data-for-seed\s10-export-0302044.json
```

Ese JSON se puede usar en `/imports/s10` para generar el draft y luego importar el proyecto, subpresupuestos, partidas, APUs e insumos a MYC.

Si SQL Server no usa seguridad integrada:

```powershell
npm.cmd run s10:sqlserver -- --list-databases --user sa --password TU_CLAVE
```

## Acceso demo

```text
Email: demo@mycpresupuestos.pe
Password: Demo12345
```

Tambien puedes crear una cuenta desde `/register`.

## Rutas principales

- `/dashboard`: resumen operativo.
- `/projects`: gestion de proyectos.
- `/budgets`: gestion de presupuestos.
- `/budgets/[id]`: presupuesto general o subpresupuesto.
- `/budgets/[id]/resources`: lista de insumos del presupuesto.
- `/budgets/[id]/general-expenses`: gastos generales.
- `/budgets/[id]/footer`: pie de presupuesto.
- `/budgets/[id]/polynomial-formula`: formula polinomica.
- `/budgets/[id]/work-schedule`: programacion de obra.
- `/budgets/[id]/risk-analysis`: riesgo Monte Carlo.
- `/metrados-avanzados`: metrados avanzados.
- `/resources`: catalogo de insumos.
- `/partidas`: catalogo de partidas.
- `/partidas/generar`: generador de partidas por similitud.
- `/unified-indices`: indices unificados.
- `/unified-index-dictionary`: diccionario de IU.
- `/ai`: workspace de IA (Khipu).
- `/api/settings/ai-provider`: GET/PUT de configuracion de proveedores cloud IA.
- `/api/settings/ai-provider/test`: POST para validar API keys (con rate limiting).
- `/api/ai/chat/stream`: streaming SSE para chat IA.
- `/settings`: configuracion.
- `/account`: cuenta y membresia.
- `/admin`: administracion.

## Flujo recomendado de prueba

1. Inicia sesion.
2. Revisa `/dashboard`.
3. Crea o abre un proyecto en `/projects`.
4. Abre el presupuesto general y sus subpresupuestos.
5. Agrega o edita partidas.
6. Abre el APU de una partida y ajusta insumos, cantidades y precios.
7. Revisa costo directo, gastos generales, utilidad, IGV y total.
8. Genera o revisa formula polinomica.
9. Crea una hoja en metrados avanzados y envia cantidades a una partida.
10. Programa partidas en cronograma y revisa curva S.
11. Ejecuta una simulacion de riesgo Monte Carlo.
12. Exporta presupuesto, APU, gastos generales, formula o cronograma.

## Scripts disponibles

```powershell
npm.cmd run dev
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
npm.cmd run prisma:normalize-resource-iu
npm.cmd run prisma:repair-companies
npm.cmd run s10:analyze
npm.cmd run s10:inspect
npm.cmd run s10:sqlserver
npm.cmd run s10:draft
```

## Verificacion recomendada

Para una validacion completa:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Para revisar calculos criticos:

```powershell
npm.cmd run test -- lib/calculations/budget.test.ts lib/calculations/apu.test.ts lib/calculations/polynomial-formula.test.ts lib/calculations/work-schedule.test.ts lib/calculations/metrados.test.ts
```

## Reglas tecnicas importantes

- Usar TypeScript strict mode.
- No usar `any`.
- Mantener calculos financieros y tecnicos aislados de la UI.
- Usar `decimal.js` para calculos monetarios y cantidades sensibles.
- Mantener coeficientes de formula polinomica a 3 decimales.
- Todas las formulas deben ser testeables.
- Preferir servicios reutilizables y arquitectura limpia.
- Usar Server Components por defecto y Client Components solo cuando haya interactividad real.

## Roadmap de mejora

### Pulido de lo existente

- Unificar textos visibles, acentos, nombres de modulos, estados vacios y mensajes de error.
- Completar flujos CRUD donde exista API pero la UI todavia sea parcial.
- Pulir editor de presupuesto: navegacion de teclado, pegado desde Excel, ordenamiento, guardado visible y validaciones inline.
- Reforzar trazabilidad tecnica: origen de calculos, advertencias, versiones, exportaciones y cambios importantes.
- Ampliar pruebas de regresion para casos peruanos: IGV, gastos generales, utilidad, subpresupuestos, redondeos, formula polinomica y exportaciones.
- Optimizar tablas grandes, calculos pesados, workers y payloads de modulos avanzados.
- Agregar onboarding guiado para crear empresa, proyecto, presupuesto, subpresupuestos base, insumos y primera exportacion.
- Mejorar estados Pro con explicacion clara de valor y desbloqueo.

### Fase 1: Consolidacion comercial

- Dashboard ejecutivo por empresa.
- Historial y auditoria por proyecto y presupuesto.
- Plantillas reutilizables de presupuestos, APUs, gastos generales y metrados.
- Importador robusto desde Excel de presupuesto completo.

### Fase 2: Productividad tecnica

- Editor tipo spreadsheet con copiar/pegar rangos, autollenado, formulas, undo/redo y validacion inline.
- Biblioteca avanzada de APUs por especialidad, rendimiento, zona, fuente y fecha.
- Comparador de presupuestos.
- Reportes configurables por cliente, entidad, licitacion o control interno.

### Fase 3: Inteligencia aplicada

- Revision integral con IA de unidades, precios fuera de rango, APUs incompletos y metrados sospechosos.
- Generacion asistida de presupuesto desde memoria descriptiva o lista de partidas.
- RAG sobre catalogos propios, presupuestos anteriores y bases historicas.
- Sugerencias de rendimientos y cuadrillas basadas en partidas similares.

### Fase 4: Control de obra

- Valorizaciones mensuales conectadas al cronograma y formula polinomica.
- Control real vs planificado: avance fisico, avance financiero, curva S real, desviaciones y alertas.
- Flujo de adicionales, deductivos, mayores metrados y ampliaciones de plazo.
- Panel de costo proyectado al termino.

### Fase 5: Colaboracion y empresa

- Multiusuario por empresa, roles y permisos por proyecto.
- Comentarios por partida y revision/aprobacion de presupuestos.
- Estados de aprobacion y firmas.
- Espacios de trabajo por cliente o contratista.
- API publica o integraciones BIM/ERP cuando el modelo de datos este estable.

## Limitaciones actuales

- Algunas experiencias avanzadas ya tienen backend y rutas, pero requieren mas pulido visual y QA de casos reales.
- La IA funciona con Ollama local, ChatGPT Bridge (extension de navegador), OpenAI API, Gemini API y OpenRouter.
- Las API keys de cloud providers se encriptan con AES-256-GCM; requieren `ENCRYPTION_KEY` en `.env` para produccion.
- Los modulos Pro existen por entitlements; en Starter se muestran bloqueos o llamados de upgrade.
- El editor tipo spreadsheet todavia no cubre toda la experiencia de Excel profesional.
- No hay colaboracion multiusuario avanzada ni permisos granulares por proyecto.
- No hay integraciones BIM/ERP productivas todavia.

## Documentacion relacionada

- `AGENTS.md`: reglas del proyecto y guia para agentes.
- `prd/prd_MYC_Presupuestos.md`: PRD principal.
- `prd/PRD_MYC_MonteCarlo_Risk_Analysis.md`: PRD de riesgo.
- `prd/prd_ai_local_myc_presupuestos_codex.md`: PRD de IA local.
- `docs/importador-delphin.md`: reglas de jerarquia, APU y porcentajes para importaciones Delphin Express.
- `docs/superpowers/plans`: planes de implementacion historicos.
- `presupuesto-ejemplo`: archivos Excel y referencias de formulas.
