## GitHub Actions (auto-deploy)
- A workflow `.github/workflows/deploy-stable.yml` is included which triggers on `push` to `stable`.
- Required repository secrets:

	- `VERCEL_TOKEN` (for CLI automatic deploy)
	- `VERCEL_ORG_ID` (optional but recommended)
	- `VERCEL_PROJECT_ID` (optional)
	- `DATABASE_URL` (used by predeploy checks for Prisma)
	- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_AUTO`, `EMAIL_MOTO` (for email sending)
	- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_AUTO_CHAT_ID`, `TELEGRAM_MOTO_CHAT_ID` (for Telegram messages)

Steps for enabling auto-deploy:
1. Go to your GitHub repo -> Settings -> Secrets -> Actions
2. Add the secrets listed above
3. Merge `master` into `stable`. The GH Action will run and deploy if `predeploy-check` passes.

# Stable Release & Deployment Strategy

This guide defines a lightweight process so changes reach production only after passing a few guardrails. It prevents accidental deploying of uncommitted or half–finished work.

## Branching Model
- `master` (or `main`): integration / ongoing development.
- `stable`: always points to last known good production version.
- Hotfixes: create `hotfix/<ticket>` from `stable`, merge back into both `stable` and `master` after verification.

## Release Flow
1. Finish feature branches -> merge into `master` via PR (code review, preview deploy).
2. When ready for production: create a release PR: `master` → `stable`.
3. On merge to `stable`: deploy to production (manual `npm run deploy:prod` OR future GitHub Action).
4. Tag commit: `vYYYY.MM.DD-N` (e.g. `v2025.11.16-1`).
5. Update `ADMIN_PANEL_STATUS.md` (optional) with summary of changes.

## Mandatory Pre-Deploy Checks
`npm run deploy:prod` performs:
- Git working directory is clean.
- Local branch is `stable` (warn if not).
- Prisma schema generated.
- Basic Next.js build completes without errors.

If any check fails, deployment stops.

## Environment & Secrets
- Use Vercel Project Env for production only (`PROD` env vars) – treat preview/staging separately.
- Never depend on unnoticed local `.env.local` changes. Commit `.env.example` updates.

## Contact Form Stability
- Keep a single source component (`ContactPageClient.tsx`). Modal relies only on a minimal subset – avoid duplicating validation logic.
- When adding new required fields, update both: DB schema → API route → page form → modal (if needed) → test regression.

## API Change Checklist
- Schema change: `npx prisma migrate dev` (local) then create migration, commit it.
- Update type definitions used by frontend (`types/* or inline`).
- Verify `/api/*` handlers trim env vars & handle errors with try/catch.

## Logging & Monitoring (Future)
- Add lightweight server logs (console) for critical API routes.
- Optionally integrate a hosted log tool; keep PII minimal.

## Rollback Procedure
1. `git checkout stable`.
2. `git log --oneline` → choose previous tag commit.
3. `git revert <sha>` OR `git reset --hard <sha>` (if safe) then redeploy.
4. Re-tag if necessary (e.g. `v2025.11.16-rollback1`).

## Future Automation (Optional)
- GitHub Action: On push to `stable` run build & `vercel deploy --prod` with token/ORG/PROJECT secrets.
- Add preview deploy comments on PRs.

## Quick Commands
```bash
# Prepare stable branch (first time)
git checkout -b stable
# After review, update stable
git checkout stable
git merge master
npm run deploy:prod
```

Keep this lean; adjust over time as complexity grows.
