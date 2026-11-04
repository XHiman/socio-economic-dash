# Maharashtra Socio-Economic Dashboard

State and district views of GDDP **and** the District Statistical Abstract (DSA) tables, backed by MariaDB.

```
frontend/   React + TypeScript + Vite + Chart.js (static build)
backend/    Node/Express read-only JSON API (mysql2, zod, helmet)
db/         schema, dev users, production read-only-user script
deploy/     nginx + systemd samples for the VM
```

Pages: **State** (GSDP, divisions, district ranking), **Districts** (KPIs, GDDP trend, sector mix vs state,
division comparison, DSA sections), **Data explorer** (any `dsa_*` table, district/taluka level, CSV export).

## Local development

Requires Node 22+ and Docker.

```bash
docker compose up -d                       # MariaDB 11.4 on 127.0.0.1:3307, loads db/schema/01_schema.sql
cp backend/.env.example backend/.env
npm --prefix backend install
npm --prefix backend run db:seed           # SYNTHETIC dev data (not real statistics)
npm --prefix backend run dev               # API on :3001
npm --prefix frontend install
npm --prefix frontend run dev              # Vite proxies /api -> :3001
```

`db/schema/01_schema.sql` is the full generated schema. Real data: load `02_load.sql` + `csv/` from the data package (see below); `db:seed` is only for synthetic data on the subset schema.

District map images are optional: put `<district-slug>.svg` in `frontend/public/maps/` (e.g. `jalgaon.svg`,
`mumbai-city.svg`); they appear automatically.

## Adding / changing DSA content

Edit `backend/src/sections.ts`. Cards are `kpis` (single row), `breakdown` (columns as categories) or `taluka`
(per-taluka rows + district total). Columns are validated against the live schema at startup (missing ones are logged and skipped).
Add `unit` per column once confirmed against the DSA data dictionary. GDDP is assumed to be in ₹ crore
(`backend/src/services/gddp.ts`, `frontend/src/lib/format.ts`) — change there if the source unit differs.
Anything not curated is still reachable through the Data explorer.

## Security model

- **DB account is SELECT-only** (`db/prod/create_readonly_user.sql`), loopback-only on the VM.
- API is GET/HEAD only; every parameter validated with zod; all values bound as parameters. Table/column names can't be
  bound, so they come only from an allowlist built from `information_schema` (+ strict identifier regex); bookkeeping columns are never exposed.
- Generic error responses (no SQL/stack leakage), 8 s query timeout, 1000-row cap, rate limiting, helmet headers.
- API binds to 127.0.0.1; nginx terminates TLS and adds HSTS/CSP, request limiting. No third-party scripts, fonts or CDNs.
- Secrets only via environment (`.env` is git-ignored).

## Deploying to the VM

1. Load schema + data into the VM's MariaDB; run `db/prod/create_readonly_user.sql` (set a real password).
2. `cd backend && npm ci && npm run build`; copy `backend/` (`dist`, `package*.json`, `node_modules` via `npm ci --omit=dev`) to `/opt/socioecon/backend`.
3. Create `/etc/socioecon/api.env` (mode 600) from `.env.example`: `NODE_ENV=production`, `DB_PORT=3306`, `TRUST_PROXY=1`, real `DB_PASSWORD`; no admin vars.
4. Install `deploy/socioecon-api.service`; `systemctl enable --now socioecon-api`.
5. `cd frontend && npm ci && npm run build`; copy `dist/` to `/var/www/socioecon`; install `deploy/nginx.conf` with your domain/cert.
6. Check `https://<host>/api/health`.

Tests: `npm --prefix backend test`. Dev-only: `db:seed` refuses to run with `NODE_ENV=production`.
