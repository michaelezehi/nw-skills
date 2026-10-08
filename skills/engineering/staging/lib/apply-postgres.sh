#!/bin/bash
# /staging — orchestration reference for Postgres-project application.
# This is a CHECKLIST for the Claude agent running the skill.
# It does NOT execute file writes — Claude does that via Edit/Write tools
# so it can show diffs and handle merging with existing files.
#
# Usage from skill: read this file, follow each step, substitute placeholders.

cat <<'STEPS'
APPLICATION CHECKLIST (for Claude agent):

For each file below, render the corresponding template with placeholder substitution
(see SKILL.md "Templates" section for placeholder list). If the file already exists,
SHOW THE USER THE DIFF and ask before overwriting non-template content.

1. docker/docker-compose.staging.yml
   ← templates/docker-compose.staging.yml.tpl
   - If file exists with old (full) staging stack: REWRITE entirely (drop gateway, postgres, redis services).
   - If file absent: WRITE.

2. docker/nginx-gateway/conf.d/ssl-staging.conf
   ← templates/ssl-staging.conf.tpl
   - If a `.disabled` or `.template` sibling exists, DELETE those after writing the .conf.
   - If file already exists with old upstream names: REPLACE.

3. .env.staging.example
   ← templates/env.staging.example.tpl
   - If file exists: MERGE — add WorkOS section if missing, fix DB_HOST/DB_NAME if wrong, leave user-edited keys alone.

4. docker/postgres/init-staging.sql
   ← templates/init-staging-db.sql.tpl
   - WRITE new file. Do NOT append to docker/postgres/init.sql (init.sql runs on first DB
     boot only; staging DB is created later out-of-band).

5. scripts/deploy-staging.sh
   ← templates/deploy-staging.sh.tpl
   - REWRITE entirely (existing file restarts gateway/infra; new one only swaps apps).
   - chmod +x after write.

6. package.json
   - APPEND scripts (do not remove existing ship:* scripts):
       "ship:staging": "bash scripts/deploy-staging.sh"
       "ship:staging:migrate": "bash scripts/deploy-staging.sh --migrate"
       "ship:staging:seed": "bash scripts/deploy-staging.sh --seed"
       "ship:staging:nopull": "bash scripts/deploy-staging.sh --no-pull"

7. _r&d/staging/PREREQUISITES.md
   ← templates/PREREQUISITES.md.tpl
   - WRITE. mkdir -p _r&d/staging first.

8. _r&d/staging/QA-ONBOARDING.md
   ← templates/QA-ONBOARDING.md.tpl
   - WRITE.

9. CLEANUP:
   - Delete docker/nginx-gateway/conf.d/ssl-staging.conf.disabled (if present)
   - Delete docker/nginx-gateway/conf.d/ssl-staging.conf.template (if present, replaced by .conf)
   - Note: do NOT delete ssl.conf.disabled or ssl.conf.template — those belong to prod.

After all writes, print step-by-step next actions from PREREQUISITES.md.
STEPS
