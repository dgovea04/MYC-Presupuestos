# PRD — AI Cost Estimation Web App (Perú)

## Producto Base + Roadmap IA

Versión: 1.0  
Fecha: Mayo 2026  
Mercado objetivo inicial: Perú  
Referencia funcional: Presupuestos.pe  
Tipo de producto: SaaS Web App (B2B + B2C)

---

# 1. Visión del Producto

Construir una plataforma SaaS web enfocada en costos y presupuestos de obra bajo metodología peruana de Análisis de Precios Unitarios (APU), permitiendo a ingenieros, arquitectos, contratistas, estudiantes y oficinas técnicas:

- Crear presupuestos de obra estructurados.
- Calcular costos unitarios automáticamente.
- Gestionar insumos y partidas.
- Programar obra y materiales.
- Generar reportes exportables.
- Colaborar entre usuarios.
- Escalar posteriormente a funciones avanzadas impulsadas por IA.

El MVP gratuito debe resolver el flujo principal de:

"Crear un presupuesto completo de obra de manera estructurada y profesional siguiendo estándares peruanos."

La fase premium posteriormente agregará:

- AI Cost Estimation
- Generación automática de APUs
- Predicción de costos
- OCR de metrados y planos
- Asistente técnico IA
- Benchmarks y análisis históricos
- Generación automática de partidas
- Optimización de cronogramas y recursos

---

# 2. Objetivos del Producto

## Objetivo Principal

Convertirse en la plataforma SaaS líder de costos y presupuestos de construcción en Perú y LATAM.

## Objetivos de Negocio

### Fase 1 — MVP Gratuito

- Validar mercado.
- Conseguir adopción orgánica.
- Capturar leads.
- Construir catálogo de datos.
- Obtener feedback.

### Fase 2 — SaaS Premium

- Suscripciones mensuales.
- IA aplicada a costos.
- Automatización avanzada.
- Marketplace de plantillas/APUs.
- API para constructoras.

---

# 3. Usuarios Objetivo

## Primarios

### Ingenieros civiles

Necesitan:

- Presupuestos rápidos.
- APUs precisos.
- Reportes profesionales.
- Compatibilidad con normas peruanas.

### Contratistas

Necesitan:

- Costos reales.
- Control de materiales.
- Programación.
- Presentación de propuestas.

### Oficinas Técnicas

Necesitan:

- Estandarización.
- Colaboración.
- Reutilización de plantillas.
- Multiusuario.

## Secundarios

### Estudiantes

Necesitan:

- Aprender APUs.
- Simular presupuestos.
- Exportar reportes.

### Arquitectos

Necesitan:

- Presupuestos preliminares.
- Compatibilidad con metrados.

---

# 4. Propuesta de Valor

## Diferenciador Inicial

"La forma más rápida y estructurada de crear presupuestos de obra en Perú."

## Diferenciador Futuro

"La primera plataforma de costos de construcción impulsada por IA para Latinoamérica."

---

# 5. Funcionalidades del MVP (Gratis)

# 5.1 Autenticación y Usuarios

## Funciones

- Registro/login.
- Recuperación de contraseña.
- Perfil de usuario.
- Perfil de empresa.
- Roles básicos.
- Gestión de suscripción futura.

## Roles Iniciales

### Usuario Free

- Presupuestos limitados.
- Exportación básica.

### Usuario Premium (Roadmap)

- IA.
- Exportaciones avanzadas.
- Colaboración.
- API.

---

# 5.2 Dashboard Principal

## Objetivo

Centralizar proyectos y presupuestos.

## Componentes

- Lista de presupuestos.
- Últimos proyectos.
- Presupuestos recientes.
- Accesos rápidos.
- Estadísticas.
- Plantillas destacadas.

## Widgets

- Total presupuestos.
- Costo total acumulado.
- Última actualización.
- Calendario de obra.

---

# 5.3 Gestión de Proyectos / Obras

## Campos

- Nombre de obra.
- Cliente.
- Ubicación.
- Tipo de obra.
- Fecha inicio.
- Fecha fin.
- Moneda.
- IGV.
- Estado.

## Tipos de obra

- Edificación.
- Irrigación.
- Electrificación.
- Pavimentación.
- Puentes.
- Saneamiento.
- Vivienda.
- Industrial.

---

# 5.4 Módulo de Presupuestos

## Función Principal

Crear estructura jerárquica de presupuesto.

## Estructura

- Título.
- Subtítulo.
- Partida.
- Subpartida.
- Pie de presupuesto.

## Funcionalidades

### CRUD Completo

- Crear.
- Editar.
- Duplicar.
- Eliminar.
- Reordenar drag-and-drop.

### Metrados

Campos:

- Largo.
- Ancho.
- Alto.
- Cantidad.
- Fórmulas.
- Unidad.
- Resultado.

### Operaciones

- Copiar partidas.
- Pegar partidas.
- Importar plantilla.
- Clonar presupuesto.
- Versionado.

### Totales

- Costo directo.
- Gastos generales.
- Utilidad.
- Subtotal.
- IGV.
- Total final.

---

# 5.5 Catálogo de Insumos

## Base Inicial

~6,500 insumos.

## Categorías

### Materiales

- Cemento.
- Acero.
- Agregados.
- Tuberías.
- Concreto.

### Mano de Obra

- Operario.
- Oficial.
- Peón.

### Equipos

- Excavadora.
- Mixer.
- Compactadora.

### Herramientas

- Equipos menores.

## Campos del Insumo

- Código.
- Descripción.
- Unidad.
- Precio.
- Categoría.
- Subcategoría.
- Moneda.
- Rendimiento.
- Proveedor.
- Fecha actualización.

## Funciones

- Buscar.
- Filtrar.
- Editar precios.
- Historial de precios.
- Favoritos.
- Duplicar.

---

# 5.6 Catálogo de Partidas / ACU

## Base Inicial

~500–550 APUs precargados.

## Componentes del APU

### Mano de Obra

- Rendimiento.
- Horas.
- Cuadrilla.

### Materiales

- Cantidades.
- Desperdicio.

### Equipos

- Horas máquina.
- Rendimientos.

### Herramientas

- Porcentaje.

## Cálculo

Costo Unitario = Σ(Materiales + Mano de Obra + Equipos + Herramientas)

## Funciones

- Crear APU.
- Editar APU.
- Duplicar.
- Importar.
- Vincular insumos.
- Historial.
- Versiones.

---

# 5.7 Motor de Cálculo

## Responsabilidad

Calcular automáticamente:

- Costos unitarios.
- Costos directos.
- Gastos generales.
- Utilidad.
- Impuestos.
- Totales.

## Reglas

### Fórmulas Paramétricas

Ejemplo:

- GG = CD × 0.10
- UTILIDAD = CD × 0.08
- IGV = SUBTOTAL × 0.18

## Características Técnicas

- Recalculo en tiempo real.
- Alta precisión decimal.
- Cache de cálculos.
- Validaciones automáticas.

---

# 5.8 Gastos Generales

## Tipos

### Fijos

- Oficina técnica.
- Supervisión.
- Seguridad.

### Variables

- Administración.
- Servicios.
- Logística.

## Funciones

- Configuración por porcentaje.
- Configuración manual.
- Plantillas.
- Inclusión/exclusión.

---

# 5.9 Fórmula Polinómica

## Objetivo

Reajuste de precios según normativa peruana.

## Componentes

- Índices unificados.
- Coeficientes.
- Monomios.

## Funciones

- Crear fórmula.
- Editar coeficientes.
- Recalcular.
- Reporte automático.

---

# 5.10 Programación de Obra

## Objetivo

Programar avance valorizado.

## Funciones

### Calendario de Obra

- Duración.
- Inicio.
- Fin.
- Porcentaje avance.
- Distribución mensual.

### Calendario de Insumos

- Consumo por período.
- Materiales valorizados.
- Curva S básica.

### Vista

- Tabla valorizada.
- Barras simples.
- Cronograma básico.

---

# 5.11 Reportes

## Exportables

### PDF

- Presupuesto.
- APU.
- Fórmula polinómica.
- Cronograma.

### Excel

- Compatible con formatos tradicionales.
- Exportación multihoja.

## Reportes Clave

- Resumen presupuesto.
- Análisis de costos unitarios.
- Listado de insumos.
- Gastos generales.
- Programación.

---

# 5.12 Colaboración

## Funciones

- Compartir presupuesto.
- Invitar usuarios.
- Permisos.
- Historial de cambios.
- Comentarios.

## Roles

- Editor.
- Visualizador.
- Administrador.

---

# 6. Arquitectura Funcional

# 6.1 Entidades Principales

## Usuarios

- id
- nombre
- email
- empresa_id
- rol
- plan

## Empresas

- id
- nombre
- ruc
- logo

## Obras

- id
- nombre
- ubicación
- tipo

## Presupuestos

- id
- obra_id
- versión
- moneda
- estado

## Niveles

- id
- presupuesto_id
- parent_id
- tipo

## Partidas

- id
- código
- descripción
- unidad
- cantidad
- precio_unitario

## Insumos

- id
- código
- descripción
- categoría
- precio

## APUs

- id
- partida_id
- rendimiento

## Programaciones

- id
- presupuesto_id

## Fórmulas Polinómicas

- id
- presupuesto_id

---

# 7. Arquitectura Técnica Recomendada

# 7.1 Stack Recomendado

## Frontend

### Opción Recomendada

- Next.js
- React
- TypeScript
- Tailwind
- Shadcn/UI

## Backend

### Opción Recomendada

- NestJS
- TypeScript
- REST API

Alternativa:

- Laravel
- Django

## Base de Datos

### PostgreSQL

Razones:

- Relaciones complejas.
- Transacciones.
- Escalabilidad.
- JSON support.

## ORM

- Prisma

## Infraestructura

- Vercel (frontend)
- Railway / Render / AWS
- Supabase Auth opcional
- S3 compatible storage

## Exportación

- ExcelJS
- PDFKit
- Puppeteer

---

# 8. Diseño UX/UI

# 8.1 Principios

## Inspiración

- Excel híbrido.
- ERP moderno.
- Notion + Spreadsheet.

## Objetivos

- Velocidad.
- Familiaridad.
- Bajo aprendizaje.

---

# 8.2 Componentes Clave

## Tabla Editable Tipo Spreadsheet

Debe soportar:

- Navegación teclado.
- Copy/paste.
- Fórmulas.
- Selección múltiple.
- Drag fill.

## Sidebar

- Proyectos.
- Plantillas.
- Insumos.
- Reportes.

## Header

- Guardado automático.
- Exportar.
- Compartir.

---

# 9. Roadmap IA (Premium)

# 9.1 AI Cost Estimation

## Objetivo

Generar presupuestos automáticamente usando IA.

## Casos de Uso

### Entrada Natural

Usuario escribe:

"Necesito un presupuesto para una vivienda de 120m² de 2 pisos en Lima"

IA genera:

- Partidas.
- APUs.
- Insumos.
- Cantidades estimadas.
- Cronograma preliminar.

---

# 9.2 OCR + Planos

## Objetivo

Leer planos PDF/DWG/imágenes.

## Funciones

- Detectar ambientes.
- Detectar dimensiones.
- Extraer metrados.
- Sugerir partidas.

---

# 9.3 AI Assistant

## Chat Técnico

Ejemplos:

- "¿Por qué aumentó el costo?"
- "Optimiza este presupuesto"
- "Reduce costos 10%"
- "Sugiere alternativas"

---

# 9.4 AI Benchmarking

## Objetivo

Comparar presupuestos históricos.

## Funciones

- Detectar sobrecostos.
- Detectar anomalías.
- Comparar precios regionales.

---

# 9.5 AI Forecasting

## Objetivo

Predicción de costos futuros.

## Variables

- Inflación.
- Mercado.
- Históricos.
- Variaciones regionales.

---

# 10. Monetización

# 10.1 Modelo Freemium

## Gratis

- 3 presupuestos.
- Exportación básica.
- Catálogo limitado.

## Pro

- Presupuestos ilimitados.
- Exportaciones premium.
- Plantillas.
- Colaboración.

## AI Premium

- AI Estimation.
- OCR.
- Asistente IA.
- Benchmarks.

---

# 11. Integraciones Futuras

## BIM / CAD

- AutoCAD.
- Revit.
- IFC.

## ERP

- SAP.
- Odoo.

## Cloud Storage

- Google Drive.
- Dropbox.

## APIs de Precios

- Índices oficiales.
- Proveedores.

---

# 12. Seguridad

## Requisitos

- JWT auth.
- Encriptación.
- Backups.
- Versionado.
- Logs.
- Permisos.

---

# 13. Performance

## Objetivos

- Recalculo < 200ms.
- Exportación < 10s.
- Presupuestos grandes soportados.
- 10k+ partidas por proyecto.

---

# 14. Escalabilidad

## Arquitectura futura

- Microservicios.
- Workers para exportación.
- Queue system.
- AI inference service.

---

# 15. Analítica

## Métricas Clave

- Presupuestos creados.
- Exportaciones.
- Partidas reutilizadas.
- Tiempo de creación.
- Usuarios activos.

---

# 16. KPIs del MVP

## Objetivos Iniciales

- 1,000 usuarios registrados.
- 100 usuarios activos semanales.
- 50 presupuestos/día.
- 15% conversión a pago.

---

# 17. Priorización MVP

# Fase 1 — Core

✅ Login  
✅ Dashboard  
✅ Presupuestos  
✅ APUs  
✅ Insumos  
✅ Exportación Excel/PDF  
✅ Gastos Generales  
✅ Fórmula Polinómica  

# Fase 2

✅ Programación  
✅ Colaboración  
✅ Plantillas  
✅ Historial  

# Fase 3

✅ IA Estimation  
✅ OCR  
✅ AI Assistant  
✅ Forecasting  

---

# 18. Recomendación Estratégica

## Lo más importante del MVP

NO construir primero:

- IA compleja.
- BIM.
- Gantt sofisticado.
- Integraciones pesadas.

SÍ construir primero:

- Excelente motor APU.
- UX tipo Excel.
- Exportación profesional.
- Catálogo sólido.
- Velocidad.

---

# 19. Arquitectura de Datos IA (Muy Importante)

El verdadero valor del producto será la data.

Cada presupuesto creado permitirá construir:

- Dataset de costos.
- Dataset de partidas.
- Dataset de productividad.
- Dataset regional.
- Dataset histórico.

Eso se convertirá en:

- Modelos predictivos.
- Recomendaciones.
- Pricing intelligence.
- Benchmarking.

La ventaja competitiva futura NO será solamente el software.

Será el dataset de construcción peruana.

---

# 20. Recomendación Técnica Final

## Stack Ideal para Codex

### Frontend

- Next.js
- React
- TypeScript
- Tailwind
- TanStack Table
- Zustand

### Backend

- NestJS
- Prisma
- PostgreSQL

### Infraestructura

- Vercel
- Supabase
- Railway

### IA futura

- OpenAI
- Claude
- OCR models
- RAG system

---

# 21. Estructura Recomendada de Base de Datos

## Tablas Principales

- users
- companies
- projects
- budgets
- budget_levels
- budget_items
- apus
- apu_resources
- resources
- schedules
- schedule_items
- formulas
- reports
- templates
- activity_logs
- comments

---

# 22. Basado en los Archivos Excel de Referencia

Los archivos proporcionados ayudan a definir la estructura inicial del sistema:

- Presupuesto.xlsx
- Presupuestos Resumen.xlsx
- Análisis de Costos Unitarios.xlsx
- Listado de Insumos.xlsx
- Programación.xlsx
- Fórmula Polinómica.xlsx
- Gastos_Generales.xlsx
- SubPartidas.xlsx

Estos archivos deben utilizarse como referencia directa para:

- Diseño de tablas.
- Estructura de reportes.
- Compatibilidad de exportación.
- Naming conventions.
- Flujo de trabajo técnico.
- Estructura jerárquica del presupuesto.

---

# 23. Recomendación de MVP Comercial

## Landing Inicial

### Hero

"Crea presupuestos de obra profesionales en minutos."

### CTA

"Empieza Gratis"

## Lead Magnet

- Plantillas gratuitas.
- APUs gratuitos.
- Ejemplos de presupuestos.

## Estrategia Growth

- SEO técnico.
- Tutoriales YouTube.
- Comunidad estudiantes.
- TikTok/Instagram ingeniería.
- Plantillas descargables.

---

# 24. Visión a Largo Plazo

La visión NO es solamente crear un software de presupuestos.

La visión es construir:

"La plataforma inteligente de costos y planificación de construcción para Latinoamérica."

