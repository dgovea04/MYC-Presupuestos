
# PRD — Arquitectura de Plataforma (Web-First + Desktop Wrapper)

## 1. Objetivo

Migrar oficialmente la estrategia de despliegue de MC Presupuestos a una arquitectura **Web-First**, donde la aplicación web sea el producto principal y las aplicaciones de escritorio funcionen únicamente como clientes del mismo sistema, replicando el modelo utilizado por ClickUp.

Esta arquitectura permitirá:

* Un solo código fuente.
* Un solo backend.
* Un solo sistema de autenticación.
* Actualizaciones continuas.
* Despliegues rápidos.
* Compatibilidad futura con Desktop y Mobile sin duplicar lógica.

---

# 2. Visión del Producto

MC Presupuestos evolucionará desde un software tradicional de presupuestos hacia un **Construction Cost Operating System**, donde todos los módulos compartirán un mismo Workspace empresarial.

```text
MC Presupuestos Cloud

Workspace (Empresa)
│
├── Dashboard
├── Proyectos
│
├── Presupuestos
├── APU
├── Metrados
├── Programación
├── Fórmula Polinómica
├── Reportes
├── Riesgos
├── Documentos
├── IA Khipu
└── Configuración
```

Todos los módulos compartirán:

* autenticación
* usuarios
* permisos
* comentarios
* historial
* archivos
* IA
* búsqueda global

---

# 3. Arquitectura Objetivo

```text
                  Internet

                      │

             app.mcpresupuestos.com

                      │

        Next.js (Frontend + API)

                      │

        Authentication (NextAuth/Auth.js)

                      │

             PostgreSQL (Cloud)

                      │

          Prisma ORM

                      │

         Storage (S3 / Cloudflare R2)

                      │

     IA (OpenAI / Gemini / Ollama)
```

Desktop:

```text
Windows

Tauri

↓

Carga

https://app.mcpresupuestos.com
```

Mac:

```text
Tauri

↓

Misma WebApp
```

Linux:

```text
Tauri

↓

Misma WebApp
```

No existirá lógica exclusiva para Desktop.

---

# 4. Objetivos Funcionales

## Debe existir una única aplicación

No habrá:

* versión web
* versión desktop
* versión mobile

Existirá una sola aplicación.

Los distintos clientes únicamente cambiarán el contenedor.

---

## Desktop será un Wrapper

Desktop deberá:

* abrir la misma aplicación web
* mantener sesión iniciada
* soportar notificaciones
* permitir abrir archivos locales (futuro)
* integrarse con el sistema operativo

No deberá contener lógica de negocio.

---

## Backend Único

Toda la lógica deberá ejecutarse en el backend cloud.

Ejemplos:

* generar APU
* calcular presupuestos
* revisar IA
* colaboración
* reportes
* simulaciones Monte Carlo

Nunca dentro del Desktop.

---

# 5. Sistema de Autenticación

La autenticación será completamente centralizada.

```text
Usuario

↓

Login

↓

JWT / Session

↓

Workspace

↓

Permisos

↓

Aplicación
```

Proveedores soportados:

* Email + Password
* Google OAuth
* Microsoft (futuro)

---

# 6. Modelo de Workspace

Inspirado en ClickUp.

```text
User

↓

Company (Workspace)

↓

Projects

↓

Budgets

↓

APU

↓

Resources
```

Un usuario podrá pertenecer a múltiples empresas.

Ejemplo:

```text
Juan

↓

Empresa A

↓

Empresa B

↓

Empresa C
```

Al iniciar sesión podrá cambiar de Workspace sin volver a autenticarse.

---

# 7. Sistema de Membresías

Las licencias pertenecerán a la empresa (Workspace), no al usuario.

```text
Company

↓

Membership Plan

↓

Features

↓

Limits
```

Ejemplo:

Starter

* 1 usuario
* 5 proyectos
* IA limitada

Pro

* usuarios ilimitados
* colaboración
* reportes
* programación

Enterprise

* SSO (futuro)
* auditoría
* API
* soporte prioritario

---

# 8. Verificación de Licencia

La verificación se realizará en cada sesión.

Proceso:

```text
Login

↓

Obtener Workspace

↓

Obtener Membership

↓

Obtener Feature Flags

↓

Construir Menú

↓

Renderizar UI
```

No deberán existir verificaciones dispersas en múltiples componentes.

Toda la información deberá cargarse una única vez.

---

# 9. Feature Flags

Cada funcionalidad deberá depender de Feature Flags.

Ejemplo:

```text
feature_ai

feature_reports

feature_schedule

feature_gantt

feature_montecarlo

feature_realtime

feature_comments

feature_api
```

La UI deberá ocultar automáticamente funcionalidades no disponibles.

---

# 10. Roles

Workspace

↓

Usuarios

```text
Owner

Admin

Editor

Viewer

Guest (futuro)
```

Permisos mínimos:

Owner

* administrar empresa
* cambiar plan
* eliminar empresa

Admin

* administrar proyectos
* usuarios

Editor

* editar presupuestos

Viewer

* solo lectura

---

# 11. Persistencia de Sesión

Desktop y Web compartirán exactamente el mismo flujo.

```text
Login

↓

Refresh Token

↓

Access Token

↓

Silent Refresh

↓

Continuar sesión
```

El usuario no deberá iniciar sesión constantemente.

---

# 12. Actualizaciones

Modelo continuo.

```text
Deploy

↓

Todos reciben actualización

↓

No existen instaladores
```

Desktop solo actualizará el contenedor cuando sea necesario.

---

# 13. Arquitectura Frontend

Una sola base de código.

```text
Next.js

↓

App Router

↓

React

↓

Tailwind

↓

shadcn/ui

↓

TanStack Query

↓

Zustand
```

No se permitirá código exclusivo para Desktop salvo adaptadores de integración (por ejemplo, selección de archivos locales o notificaciones nativas).

---

# 14. PWA (Fase futura)

La aplicación deberá diseñarse para ser compatible con Progressive Web App.

Objetivos:

* instalación desde navegador
* icono propio
* funcionamiento parcial offline
* caché inteligente
* sincronización cuando vuelva la conexión

---

# 15. Desktop Wrapper (Fase 2)

Se implementará utilizando **Tauri**.

Objetivos:

* Windows
* macOS
* Linux

Funciones adicionales futuras:

* abrir archivos Excel locales
* importar/exportar archivos grandes
* integración con impresoras
* notificaciones nativas
* asociaciones de archivos

Toda la lógica seguirá ejecutándose en la WebApp.

---

# 16. Beneficios Esperados

## Técnicos

* Un único código fuente.
* Menor costo de mantenimiento.
* Despliegues continuos.
* Actualizaciones inmediatas.
* Escalabilidad para nuevos módulos.

## De negocio

* Lanzamiento más rápido de nuevas funciones.
* Menor costo de soporte.
* Fácil incorporación de nuevos clientes.
* Modelo SaaS preparado para crecimiento.
* Posibilidad de ofrecer desktop sin duplicar desarrollo.

---

# 17. Roadmap de Implementación

| Fase   | Objetivo                                                    | Prioridad |
| ------ | ----------------------------------------------------------- | --------- |
| Fase 1 | WebApp SaaS estable (Next.js + Auth + Workspace + Planes)   | 🔴 Alta   |
| Fase 2 | Sistema de roles, permisos y Feature Flags                  | 🔴 Alta   |
| Fase 3 | Beta privada con empresas reales                            | 🔴 Alta   |
| Fase 4 | PWA instalable                                              | 🟡 Media  |
| Fase 5 | Aplicación Desktop con Tauri (wrapper)                      | 🟡 Media  |
| Fase 6 | Integraciones nativas (Excel, archivos locales, impresoras) | 🟢 Baja   |
| Fase 7 | Aplicación móvil para consulta y aprobaciones               | 🟢 Baja   |

## Criterios de Éxito

* La WebApp es el único origen de verdad para la lógica de negocio.
* Un usuario puede acceder desde navegador o Desktop con la misma experiencia y datos.
* Las licencias, roles y permisos se administran a nivel de **Workspace (Company)**.
* Todas las funcionalidades se habilitan mediante **Feature Flags**, sin ramificaciones de código por plataforma.
* El Desktop funciona como un cliente ligero sincronizado con la WebApp, evitando mantener dos aplicaciones independientes.

Esta arquitectura posiciona a **MC Presupuestos** como un **Construction Cost Operating System** moderno, escalable y preparado para crecer con nuevos módulos (compras, valorizaciones, BIM, colaboración, IA Khipu, analítica, etc.) sin cambiar la base tecnológica.
