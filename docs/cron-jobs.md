# Cron Jobs — MC Presupuestos

## `GET /api/cron/reactivate-members`

Proactively reactivates workspace members whose timed suspension has expired (`suspendedUntil` ≤ now).

### Setup

1. **Set `CRON_SECRET`** in your environment (add to `.env`):
   ```
   CRON_SECRET=<your-secure-random-string>
   ```
   Generate a secure secret: `openssl rand -hex 32`

2. **Configure your scheduler** to call the endpoint periodically:

   **Vercel Cron Jobs** (recommended):
   Add to `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/reactivate-members",
         "schedule": "*/10 * * * *"
       }
     ]
   }
   ```
   Then set `CRON_SECRET` in your Vercel environment variables and add a `Authorization` header:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/reactivate-members",
         "schedule": "*/10 * * * *"
       }
     ]
   }
   ```
   > **Note:** Vercel cron jobs run on deployed environments only (Production/Preview), not locally.

   **GitHub Actions**:
   ```yaml
   name: Reactivate expired suspensions
   on:
     schedule:
       - cron: "*/10 * * * *"
   jobs:
     reactivate:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
               https://your-domain.com/api/cron/reactivate-members
   ```

   **Manual testing**:
   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" \
     http://localhost:3000/api/cron/reactivate-members
   ```

### Response

```json
{
  "reactivated": 3,
  "checkedAt": "2026-07-07T12:00:00.000Z"
}
```

- `reactivated`: number of members that were reactivated in this run
- `checkedAt`: ISO timestamp of when the check was performed

### How it works

1. The endpoint receives a GET request with a `Bearer <CRON_SECRET>` authorization header
2. If the secret matches `CRON_SECRET` env var, it runs:
   ```sql
   UPDATE company_memberships
   SET status = 'ACTIVE', suspendedUntil = NULL
   WHERE status = 'SUSPENDED'
     AND suspendedUntil IS NOT NULL
     AND suspendedUntil <= NOW()
   ```
3. Returns the count of reactivated members

### Defense-in-depth

The cron endpoint is one of three layers that ensure timely reactivation:

| Layer | Trigger | Scope |
|---|---|---|
| **Cron endpoint** (`/api/cron/reactivate-members`) | External scheduler (every 10 min) | All workspaces |
| **GET members list** (`/api/workspaces/[id]/members`) | Owner/Admin opens member panel | One workspace |
| **Access check** (`assertWorkspaceMembership`) | Suspended user attempts any access | One user |
