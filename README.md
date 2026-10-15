# Moneta

*Take control of your money.*

Moneta is a full-stack personal finance app for tracking income and expenses, setting monthly budgets, and understanding spending through a dashboard and reports. It emphasizes exact money arithmetic, per-user data isolation, and automated tests.

**Status:** Version 1 features are built and tested locally (transactions, budgets, dashboard, reports, accounts). Continuous integration runs on GitHub Actions. It is deployed on Render's free plan (Blueprint: `render.yaml`); see "Deployment (Render)" for the free-plan limits, including the database that expires 30 days after its creation on 2026-10-15. See [docs/DECISIONS.md](docs/DECISIONS.md) for what was decided and why.

## Features

- **Transactions:** add, edit, delete, filter and sort income and expenses by category and date.
- **Budgets:** one limit per category per month; spending, remaining amount and over-budget state.
- **Dashboard:** income, expenses, net cash flow and budget usage for a selected month.
- **Reports:** spending by category and income/expenses/net by month over a range of up to 60 months.
- **Accounts:** register, log in, log out, change password (ends every session).
- **Appearance:** light/dark mode and custom colours and fonts, saved in the browser (Profile icon, then Options).

Out of scope for version 1: bank imports, investments, shared households, recurring transactions, forecasting, multiple currencies.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Node.js, Express 5, TypeScript, zod |
| Database | PostgreSQL 16, plain SQL migrations (`node-pg-migrate`) |
| Auth | Server-side sessions in PostgreSQL, HTTP-only cookie, argon2id password hashes |
| Tests | Vitest and Supertest |
| Secrets | 1Password CLI (`op run`) |

## Architecture

```
React UI -> Express routes -> services (business rules) -> repositories (SQL) -> PostgreSQL
            (auth, validation)
```

- **Routes** handle HTTP only: parse and validate input (zod), call a service, shape the response.
- **Services** hold the business rules.
- **Repositories** hold all SQL, and every query is scoped by `user_id`.
- Dashboard, budgets and reports share one definition of "spending" (`backend/src/repositories/spending.ts`), so their numbers cannot diverge.
- In production one Express service serves both `/api` and the built React app (one origin, which the `SameSite=Lax` session cookie needs).

### Financial rules

- Money is stored as integer cents (`BIGINT`), never floats. One currency (USD).
- `amount_cents` is always positive; `type` (`income` or `expense`) carries the direction.
- Periods are half-open date ranges `[start, end)`.
- Net cash flow = income - expenses for the period. It is not an account balance.
- Budget spending = expenses in the budget's category and month. Income never counts.

The full list of decisions, with rejected alternatives, is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Running locally

### Prerequisites

- Node.js and npm (developed on Node 24)
- Docker (for PostgreSQL)
- The [1Password CLI](https://developer.1password.com/docs/cli/get-started/), signed in. Check with `op --version` and `op vault ls`. The database password is never stored in a file: `.env.op` holds only an `op://` reference, and `op run` injects the real value into the process at runtime.

### First-time setup

Run from the repository root.

```bash
# 1. Install dependencies
npm --prefix backend install
npm --prefix frontend install

# 2. Start PostgreSQL (the password is injected by 1Password)
op run --env-file=.env.op -- docker compose up -d

# 3. Create the schema
cd backend
op run --env-file=../.env.op -- npm run migrate -- up
```

In Windows PowerShell, npm's wrapper can mangle the `--`. If `migrate` misbehaves, call the tool directly (this is what the scripts in `scripts/` do):

```powershell
op run --env-file=../.env.op -- node node_modules
ode-pg-migratein
ode-pg-migrate.js --migrations-dir ../db/migrations --migration-file-language sql up
```

### Start the app (two terminals)

```bash
# Terminal 1: API on http://localhost:3000
cd backend
op run --env-file=../.env.op -- npm run dev

# Terminal 2: UI on http://localhost:5173 (proxies /api to the API)
cd frontend
npm run dev
```

Open http://localhost:5173 and register an account.

### Tests

The backend tests need a separate database named `moneta_test`; they refuse to run against anything else.

```bash
# Create (or recreate) the test database from the migrations. PowerShell, from the repo root:
op run --env-file=.env.testdb.op -- powershell -File scripts\setup-test-db.ps1

# Backend tests
cd backend
op run --env-file=../.env.testdb.op -- npm test

# Frontend tests (no database needed)
cd frontend
npm test
```

Type checks: `npm run typecheck` in either folder.

### Production build

```bash
npm --prefix frontend run build     # writes frontend/dist
npm --prefix backend run build      # writes backend/dist
cd backend && npm start             # serves the API and frontend/dist
```

## Deployment (Render)

`render.yaml` describes one web service (Express serving the API and the built frontend) and one PostgreSQL database. In the Render dashboard choose **New, then Blueprint**, and select this repository. Migrations run automatically on every start. The free plans sleep when idle, and the free database expires after 30 days with no backups; see [docs/DECISIONS.md](docs/DECISIONS.md) ("Deploying to Render") for the trade-offs and how `TRUST_PROXY` (set to 3) was measured.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` | backend | Database connection. `.env.op` supplies them; the password is an `op://` reference. |
| `PORT` | backend | Port to listen on (default 3000). |
| `DATABASE_URL` | backend | Database connection string. When set it is used instead of the `PG*` variables (Render provides the database this way). |
| `NODE_ENV` | backend | `production` turns on the `Secure` cookie flag and requires `APP_ORIGIN`. |
| `APP_ORIGIN` | backend | The exact origin of the app, e.g. `https://moneta.example.com` (no path, https in production). Used for the CSRF origin check. Required in production, unless `RENDER_EXTERNAL_URL` (set by Render) is present. |
| `TRUST_PROXY` | backend | Number of reverse-proxy hops in front of the app (1 to 99). Set it behind a proxy so rate limits see real client IPs. Leave it unset when not behind one. |
| `FRONTEND_DIST` | backend | Folder with the built frontend (default `../frontend/dist`). |
| `REGISTER_RATE_LIMIT` | backend | Registrations per IP per 15 minutes (default 10). The test suite raises it. |

Invalid `APP_ORIGIN` or `TRUST_PROXY` values stop the server at startup.

## API

All routes except `register`, `login`, `change-password`, `logout` and `/health` require a session cookie. Every route only ever sees the signed-in user's data.

| Method and path | Purpose |
|---|---|
| `POST /api/auth/register`, `/login`, `/logout`, `/change-password` | Account and session handling |
| `GET /api/auth/me` | The signed-in user |
| `GET, POST /api/categories`, `PATCH, DELETE /api/categories/:id` | Categories |
| `GET /api/transactions?from=&to=`, `POST`, `PATCH /:id`, `DELETE /:id` | Transactions (`from` inclusive, `to` exclusive, `YYYY-MM-DD`) |
| `GET /api/budgets?month=YYYY-MM`, `PUT /api/budgets`, `DELETE /api/budgets/:id` | Monthly budgets with spending and remaining |
| `GET /api/dashboard?month=YYYY-MM` | Income, expenses, net cash flow, budget usage |
| `GET /api/reports/spending-by-category?from=YYYY-MM&to=YYYY-MM` | Expenses per category |
| `GET /api/reports/over-time?from=YYYY-MM&to=YYYY-MM` | Income, expenses and net per month |
| `GET /health` | Server and database status |

## Security

- Passwords: argon2id. "No such user" and "wrong password" return the same error, in similar time.
- Sessions: random 256-bit token in an HTTP-only, `SameSite=Lax` cookie (`Secure` in production). The database stores only its SHA-256 hash. Idle and absolute expiry. Changing a password ends all sessions.
- CSRF: `SameSite=Lax` plus an `Origin` header check on state-changing requests.
- Authorization: every query filters by the session's user id, and the id never comes from the request body or URL. Other users' records answer 404.
- Input: strict zod schemas (unknown fields are rejected), request body limited to 10 KB.
- Rate limits per IP: login, change-password and register, 10 attempts per 15 minutes each.
- Headers: `helmet` (CSP, HSTS, nosniff, frame protection).
- Logs: unexpected errors are logged without database `detail` values (which can contain emails).

Known limits: rate limits are per IP only, registration reveals whether an email exists, and there is no password reset or email verification.

## Project layout

```
backend/    Express API (src/routes, services, repositories), tests in backend/tests
frontend/   React app (src/pages, components), tests next to the code
db/         SQL migrations
docs/       DECISIONS.md: architecture and financial-behaviour decisions
scripts/    PowerShell helpers: test database setup, migration check, auth smoke test
```
