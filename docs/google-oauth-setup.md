# Google OAuth Setup Guide

Guía para desarrolladores: cómo configurar "Continue with Google" en MYC Presupuestos.

## Resumen

MYC Presupuestos usa NextAuth v4 con el provider de Google para permitir que los usuarios se registren e inicien sesión con su cuenta de Google. No se requiere adapter de base de datos — el registro automático se maneja en el callback `signIn` mediante una transacción Prisma que crea User + Company + Membership (plan Starter).

## Prerrequisitos

- Cuenta de Google (personal o de la organización).
- Acceso al repositorio y al entorno de desarrollo local (`npm run dev` en `localhost:3000`).
- La migración `make_password_hash_nullable_for_google_oauth` ya aplicada en la base de datos local.

---

## 1. Google Cloud Console — Crear proyecto

1. Ir a [Google Cloud Console](https://console.cloud.google.com/).
2. Crear un proyecto nuevo o seleccionar uno existente.
   - Nombre sugerido: `myc-presupuestos`.
3. Ir a **APIs & Services** → **OAuth consent screen**.

### 1.1 OAuth Consent Screen

| Campo | Valor |
|---|---|
| User Type | External |
| App name | MYC Presupuestos |
| User support email | Tu correo |
| Developer contact email | Tu correo |
| Scopes | `openid`, `email`, `profile` (los defaults de NextAuth) |

- No agregar scopes sensibles ni restringidos.
- No subir logo de la app en esta etapa (opcional).

#### Test Users

En **Audience** → **Test users**, agregar:
- Tu correo de desarrollador.
- Correos de cualquier otro dev o tester que necesite probar el flujo.

Mientras la app esté en modo **Testing**, solo los test users pueden autenticarse.

---

## 2. Crear OAuth Client ID

1. Ir a **APIs & Services** → **Credentials**.
2. Clic en **+ Create Credentials** → **OAuth client ID**.
3. Elegir **Web application**.
4. Nombre: `myc-presupuestos-web`.

### 2.1 Authorized JavaScript Origins

| Entorno | URI |
|---|---|
| Desarrollo | `http://localhost:3000` |
| Producción | `https://mcpresupuestos.com` |

Agregar ambos si vas a probar en local y en producción con el mismo client.

### 2.2 Authorized Redirect URIs

| Entorno | URI |
|---|---|
| Desarrollo | `http://localhost:3000/api/auth/callback/google` |
| Producción | `https://mcpresupuestos.com/api/auth/callback/google` |

5. Clic en **Create**.
6. Copiar **Client ID** y **Client Secret**.

---

## 3. Variables de entorno

Agregar al archivo `.env.local` en la raíz del proyecto:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generar-un-secreto>
GOOGLE_CLIENT_ID=<tu-client-id>
GOOGLE_CLIENT_SECRET=<tu-client-secret>
```

### Generar NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

O en Windows (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Variables en producción

En Vercel o tu plataforma de deploy, configurar las mismas variables con los valores de producción:

```env
NEXTAUTH_URL=https://mcpresupuestos.com
GOOGLE_CLIENT_ID=<client-id-produccion>
GOOGLE_CLIENT_SECRET=<client-secret-produccion>
```

> **Nota:** Podés usar el mismo OAuth client para desarrollo y producción si agregaste ambos orígenes y redirect URIs en el paso 2.1. Alternativamente, creá un client separado para producción.

---

## 4. Verificar la configuración local

1. Asegurate de que la migración está aplicada:

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

2. Levantá el servidor de desarrollo:

   ```bash
   npm run dev
   ```

3. Abrí `http://localhost:3000/login`.
4. Hacé clic en **Continuar con Google**.
5. Autenticate con tu cuenta de Google (debe estar en la lista de test users).
6. Deberías ser redirigido al dashboard (`/dashboard`).

### Verificación en base de datos

Después del primer login con Google, verificá que el usuario se creó correctamente:

```sql
SELECT id, name, email, "passwordHash", role, status FROM "User" WHERE email = '<tu-correo>';
```

- `passwordHash` debe ser `NULL` (no tiene contraseña).
- `role` debe ser `USER`.
- `status` debe ser `ACTIVE`.

También verificá que se creó la compañía:

```sql
SELECT c.id, c.name, c.ruc FROM "Company" c
JOIN "User" u ON c."userId" = u.id
WHERE u.email = '<tu-correo>';
```

Y la membresía Starter:

```sql
SELECT mp.slug, mp.name FROM "MembershipPlan" mp
JOIN "User" u ON u."membershipPlanId" = mp.id
WHERE u.email = '<tu-correo>';
```

---

## 5. Pasar a producción (Production Mode)

Cuando la app esté lista para usuarios reales:

1. En Google Cloud Console → **OAuth consent screen** → **Publishing status** → cambiar a **In production**.
   - Opcional: someter a verificación si tu app lo requiere (scopes básicos como `email`/`profile` no suelen necesitarlo).
2. Verificar que los **Authorized JavaScript Origins** y **Redirect URIs** incluyan la URL de producción.
3. Configurar las variables de entorno en el entorno de producción (ver sección 3).
4. Probar el flujo completo con un usuario real (no test user).

---

## 6. Flujo técnico (qué pasa internamente)

Cuando un usuario hace clic en **Continuar con Google**:

```
Usuario → Google OAuth → NextAuth → signIn callback
                                          │
                          ┌───────────────┴───────────────┐
                          │                               │
                     Email existe                     Email nuevo
                          │                               │
                    ¿Suspendido?                   registerUserWithCompany()
                          │                         (transacción Prisma)
                    ┌─────┴─────┐                       │
                    Sí         No                User + Company
                    │          │                + Membership
                 Denegar    Permitir                   │
                                                       │
                                              JWT callback
                                              (busca en DB,
                                               agrega companyId
                                               y plan al token)
                                                       │
                                              Session callback
                                              (expone companyId
                                               y plan en session.user)
                                                       │
                                                   Dashboard
```

Archivos relevantes:

| Archivo | Rol |
|---|---|
| `lib/auth/options.ts` | Provider Google, callbacks signIn/jwt/session |
| `lib/auth/registration.ts` | Transacción User + Company + Membership |
| `components/auth/google-signin-button.tsx` | Botón UI reutilizable |
| `components/auth/login-form.tsx` | Separador + botón en login |
| `components/auth/register-form.tsx` | Separador + botón en register |
| `app/api/register/route.ts` | Detección de cuentas Google en registro tradicional |
| `prisma/schema.prisma` | `passwordHash String?` (nullable para Google users) |

---

## 7. Troubleshooting

### "Error: redirect_uri_mismatch"

El redirect URI configurado en Google Cloud Console no coincide con el que NextAuth está enviando.

- Verificar que `NEXTAUTH_URL` en `.env.local` sea exactamente `http://localhost:3000`.
- Verificar que el redirect URI en Google Cloud Console sea exactamente `http://localhost:3000/api/auth/callback/google`.
- Si usás un puerto diferente (ej. `3001`), actualizá ambos.

### "Access blocked: This app's request is invalid"

Tu correo no está en la lista de test users.

- Ir a Google Cloud Console → OAuth consent screen → Audience → Test users → agregar tu correo.

### "No fue posible iniciar sesión con Google"

Error genérico. Posibles causas:

- `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET` vacíos o incorrectos.
- La migración de `passwordHash` no fue aplicada.
- `registerUserWithCompany` falló (revisar logs del servidor).

### Usuario Google intenta login por email/contraseña

Recibirá "Credenciales inválidas". Los usuarios creados con Google no tienen contraseña (`passwordHash = NULL`). Deben usar siempre **Continuar con Google**.

### Usuario tradicional intenta registrarse con el mismo email de una cuenta Google

Recibirá: "Este correo ya está registrado mediante Google. Continúa con Google para iniciar sesión." Esto es intencional — el email ya está vinculado a una cuenta Google.

---

## 8. Tests

Para validar la implementación sin depender de Google Cloud:

```bash
# Tests unitarios de los callbacks
npx vitest run lib/auth/options.test.ts

# Tests de integración del flujo completo (signIn → jwt → session)
npx vitest run lib/auth/google-oauth-integration.test.ts

# Tests del endpoint de registro
npx vitest run app/api/register/route.test.ts
```

---

## Referencias

- [NextAuth v4 — Google Provider](https://next-auth.js.org/providers/google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- PRD: `prd/Implementación-de-Google-OAuth.md`
