#!/bin/bash
# /staging — Convex-project application checklist.
# Convex projects use the existing dev deployment as staging.
# No droplet stack needed.

cat <<'STEPS'
CONVEX APPLICATION CHECKLIST (for Claude agent):

1. Read the project's .env.local (or wherever NEXT_PUBLIC_CONVEX_URL is set).
   Confirm the dev Convex URL — looks like https://<adjective-noun-NNN>.convex.cloud

2. .env.staging.example
   - WRITE with these values (no DB/Redis section needed):
     NODE_ENV=staging
     NEXT_PUBLIC_CONVEX_URL=<dev-deployment-url>
     CONVEX_DEPLOYMENT=dev:<deployment-name>
     # plus any auth/integration env vars the project needs

3. If the project has a Vercel deploy:
   - Tell the user to add the staging hostname to Vercel project settings → Domains.
   - Tell the user to set the Vercel "Preview" environment vars from .env.staging.

4. If the project has a droplet deploy (rare for Convex projects):
   - Use the Postgres path's nginx + ssl-staging.conf templates for the frontend container only.
   - No api/worker/postgres scaffolding.

5. _r&d/staging/PREREQUISITES.md
   - WRITE a Convex-specific checklist (no DB step, no certbot if Vercel-hosted).

6. _r&d/staging/QA-ONBOARDING.md
   - WRITE — same template as Postgres path, but ADD a section:
     "## Shared dev environment caveat
     This staging frontend uses the dev Convex backend, which is also used by
     developers' local environments. Test data may overlap with dev data. Use
     the qa- prefix for orgs and the qa+ email pattern strictly."

After all writes, print next steps.
STEPS
