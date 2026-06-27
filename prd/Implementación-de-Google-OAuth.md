# PRD — Implementación de Google OAuth (Continue with Google)

**Proyecto:** MC Presupuestos
**Versión:** V1.0
**Prioridad:** Alta
**Estado:** Pendiente
**Autor:** ChatGPT
**Fecha:** Junio 2026

---

# Objetivo

Implementar autenticación mediante Google OAuth ("Continue with Google") utilizando NextAuth v4, permitiendo que los usuarios puedan registrarse e iniciar sesión con su cuenta de Google, manteniendo compatibilidad con el sistema actual de autenticación por email y contraseña.

La implementación debe integrarse con el flujo existente de creación de empresas, membresías y usuarios sin modificar la arquitectura actual.

---

# Objetivos del negocio

* Reducir la fricción durante el registro.
* Incrementar la tasa de conversión de nuevos usuarios.
* Mejorar la experiencia de inicio de sesión.
* Mantener compatibilidad con usuarios existentes.
* Evitar cuentas duplicadas utilizando el email como identificador principal.

---

# Alcance

## Incluye

* Login con Google.
* Registro automático mediante Google.
* Vinculación por email con usuarios existentes.
* Creación automática de Company.
* Asignación automática del plan Starter.
* Compatibilidad con JWT actual.
* Botón "Continue with Google" en Login.
* Botón "Continue with Google" en Register.

## No incluye

* Facebook Login.
* Microsoft Login.
* GitHub Login.
* Apple Login.
* Gestión de múltiples proveedores.
* Desvincular cuentas OAuth.
* MFA.

Estas funcionalidades quedarán para una V2.

---

# Arquitectura Actual

## Autenticación

* NextAuth v4
* JWT Strategy
* Credentials Provider
* Login mediante email/password

## Registro

Actualmente el registro:

1. crea User
2. crea Company
3. crea Membership
4. inicia sesión

Este comportamiento NO debe cambiar.

Google OAuth deberá reutilizar exactamente la misma lógica de negocio.

---

# Arquitectura Objetivo

```
Usuario

        │

Continue with Google

        │

Google OAuth

        │

NextAuth

        │

signIn callback

        │

¿Existe email?

     ┌───────────────┐
     │               │
    Sí              No
     │               │
Login          Crear usuario
                 │
                 ▼
             Transaction
                 │
       User
       Company
       Membership
                 │
                 ▼
              JWT Session
                 │
                 ▼
             Dashboard
```

---

# Requisitos Técnicos

## Google Cloud

Crear un proyecto en Google Cloud Console.

Configurar:

* OAuth Consent Screen
* External App
* Testing Mode

Agregar como Test User el correo del desarrollador.

---

## OAuth Credentials

Crear un OAuth Client tipo:

```
Web Application
```

### Authorized JavaScript Origins

Desarrollo

```
http://localhost:3000
```

Producción

```
https://mcpresupuestos.com
```

---

### Authorized Redirect URI

Desarrollo

```
http://localhost:3000/api/auth/callback/google
```

Producción

```
https://mcpresupuestos.com/api/auth/callback/google
```

---

# Variables de Entorno

Agregar al archivo `.env.local`

```env
NEXTAUTH_URL=http://localhost:3000

NEXTAUTH_SECRET=

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=
```

En producción:

```env
NEXTAUTH_URL=https://mcpresupuestos.com
```

---

# Cambios en Base de Datos

## User

Actualmente:

```prisma
passwordHash String
```

Cambiar a:

```prisma
passwordHash String?
```

Justificación:

Los usuarios creados mediante Google no poseen contraseña.

---

No realizar ningún otro cambio en el modelo.

No incorporar Adapter de NextAuth en esta versión.

---

# Flujo de Registro

Cuando un usuario selecciona:

```
Continue with Google
```

Google autentica al usuario.

NextAuth recibe:

* email
* nombre
* avatar
* email_verified

---

## Validaciones

Antes de continuar:

### Validar email

Debe existir.

---

### Validar email_verified

Si Google indica:

```
false
```

Cancelar autenticación.

---

### Usuario suspendido

Si:

```
status == SUSPENDED
```

Cancelar autenticación.

---

# Usuario Nuevo

Si el email no existe.

Crear todo dentro de una única transacción.

```
Transaction

↓

Create User

↓

Create Company

↓

Create Membership

↓

Create Company Membership

↓

Commit
```

La lógica debe reutilizar exactamente la utilizada actualmente por `/api/register`.

No duplicar lógica.

Extraer la creación de usuario a un servicio compartido si es posible.

---

# Usuario Existente

Si existe un usuario con el mismo email.

No crear registros nuevos.

Simplemente permitir el login.

No modificar Company.

No modificar Membership.

No modificar permisos.

---

# Compatibilidad con Login Tradicional

El login por Credentials debe seguir funcionando.

Si:

```
passwordHash == null
```

El método authorize debe devolver:

```
Invalid credentials
```

Sin producir errores.

---

# JWT Callback

Actualizar el callback para asegurar que el token incluya:

```
userId

companyId

role

membershipPlan

status

email
```

Toda esta información debe cargarse desde la base de datos.

No depender únicamente de los datos enviados por Google.

---

# Session Callback

La sesión debe exponer:

```
session.user.id

session.user.companyId

session.user.role

session.user.plan

session.user.status
```

Manteniendo compatibilidad con el código existente.

---

# UI

## Login

Agregar separador.

```
────────────

o continúa con

────────────
```

Botón:

```
Continue with Google
```

Características:

* Icono oficial Google
* Bordes suaves
* Altura consistente con botón principal
* Hover ligero
* Responsive

---

## Register

Agregar exactamente el mismo botón.

No duplicar componentes.

Crear:

```
components/auth/google-signin-button.tsx
```

Reutilizar en Login y Register.

---

# Mensajes

## Registro

Si el email pertenece a Google.

Mostrar:

```
Este correo ya está registrado mediante Google.

Continúa con Google para iniciar sesión.
```

---

## Usuario suspendido

```
Tu cuenta ha sido suspendida.

Comunícate con soporte.
```

---

## Error Google

```
No fue posible iniciar sesión con Google.

Inténtalo nuevamente.
```

---

# Seguridad

Obligatorio:

* Validar email_verified.
* No confiar únicamente en datos del cliente.
* Buscar usuario siempre mediante email.
* Utilizar transacciones Prisma.
* Mantener JWT firmado mediante NEXTAUTH_SECRET.
* No almacenar tokens de Google.
* No solicitar scopes adicionales.

Scopes requeridos:

```
openid

email

profile
```

---

# Archivos a Modificar

| Archivo                                    | Acción                       |
| ------------------------------------------ | ---------------------------- |
| `.env.local`                               | Variables Google             |
| `prisma/schema.prisma`                     | passwordHash nullable        |
| `prisma/migrations/*`                      | Nueva migración              |
| `lib/auth/options.ts`                      | GoogleProvider               |
| `lib/auth/options.ts`                      | callbacks                    |
| `components/auth/login-form.tsx`           | Botón Google                 |
| `components/auth/register-form.tsx`        | Botón Google                 |
| `components/auth/google-signin-button.tsx` | Nuevo componente             |
| `/api/register`                            | Mensajes para cuentas Google |

---

# Pruebas

## Caso 1

Usuario nuevo mediante Google.

Resultado esperado:

* User creado.
* Company creada.
* Membership creada.
* Login exitoso.

---

## Caso 2

Usuario existente mediante Google.

Resultado esperado:

* Login exitoso.
* No crear registros.

---

## Caso 3

Usuario existente por email/password inicia sesión con Google usando el mismo email.

Resultado esperado:

* Login exitoso.
* Sin duplicados.

---

## Caso 4

Usuario suspendido.

Resultado esperado:

Acceso denegado.

---

## Caso 5

Usuario con email no verificado.

Resultado esperado:

Acceso denegado.

---

## Caso 6

Login tradicional.

Resultado esperado:

Sin cambios respecto al comportamiento actual.

---

## Caso 7

Usuario Google intenta usar contraseña.

Resultado esperado:

Mensaje de credenciales inválidas o sugerencia para iniciar sesión con Google.

---

# Criterios de Aceptación

* El usuario puede autenticarse con Google desde Login y Register.
* No se generan usuarios duplicados.
* La creación de User, Company y Membership ocurre en una única transacción.
* El sistema reutiliza la lógica existente de registro.
* El login por email continúa funcionando sin regresiones.
* Los usuarios suspendidos no pueden acceder.
* Solo se aceptan cuentas de Google con email verificado.
* El diseño del botón mantiene la identidad visual de MC Presupuestos.
* La implementación es compatible con el despliegue en Vercel y no requiere cambios adicionales al pasar de localhost a producción, salvo actualizar las credenciales OAuth.
