# Vercel Deployment Checklist

## Preflight local

Run these commands before creating or promoting a deployment:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
```

`npm.cmd run build` is the minimum gate for Vercel. `lint`, `typecheck`, and `test`
remain quality gates and should be kept green before a production release.

## Required Vercel environment variables

Set these for Production and Preview as appropriate:

```env
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEXT_PUBLIC_APP_URL=
ENCRYPTION_KEY=
CRON_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
CONTACT_TO=
NEXT_PUBLIC_PLATFORM_RUNTIME=web
MYC_ENABLE_LOCAL_SERVICES=false
NEXT_PUBLIC_ENABLE_LOCAL_SERVICES=false
```

Optional cloud AI fallbacks:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-chat-v3-0324:free
AUTO_MIGRATE_WORKFLOWS=false
```

## Database

Use a production PostgreSQL database. Before the first production deploy, run:

```powershell
npx prisma migrate deploy
npm.cmd run prisma:generate
```

Seed base production data without demo users or demo project:

```powershell
$env:SEED_DEMO_DATA="false"
npm.cmd run prisma:seed
```

Create the official production administrator:

```powershell
$env:ADMIN_EMAIL="admin@tu-dominio.com"
$env:ADMIN_PASSWORD="usa-una-clave-larga-y-unica"
$env:ADMIN_NAME="Administrador"
$env:ADMIN_COMPANY_NAME="Tu Empresa"
npm.cmd run admin:create
```

Seed demo data only in disposable Preview environments:

```powershell
npm.cmd run prisma:seed
```

## Cron

`vercel.json` registers `/api/cron/reactivate-members`. Vercel sends
`CRON_SECRET` automatically as `Authorization: Bearer <CRON_SECRET>` when the
environment variable exists, and the route also accepts the same bearer token for
manual testing.

## Production smoke test

After deployment, verify:

- Registration and login.
- Dashboard loads with the production database.
- Create project, budget, item, and APU.
- Generate PDF/Excel exports.
- Stripe checkout, portal, and webhook.
- Google OAuth callback URL.
- Contact and verification emails.
- `/api/cron/reactivate-members` with bearer auth.
- Cloud AI provider health. Ollama and SQL Server S10 local features must stay disabled online.
