# Moneta: Phase 0 Decisions

Status: **decided, nothing implemented yet.** Greenfield project; no prior code existed.

## Stack

| Layer | Choice | Why | Rejected |
|---|---|---|---|
| Frontend | React + TypeScript (Vite) | Component/state/forms practice | Next.js (blurs the FE/BE boundary) |
| Backend | Node.js + Express + TypeScript | Explicit REST, middleware, validation, layering | FastAPI, Spring Boot (not chosen) |
| Database | PostgreSQL | Real constraints, transactions, aggregation SQL | SQLite (weak constraints, unlike production) |
| Auth | Multi-user, login from day one | Retrofitting `user_id` later is risky | Single-user v1 |

## Financial rules (all six ACCEPTED by owner; hard delete accepted deliberately for v1)

1. **Money is stored as integer minor units (cents)** in a `BIGINT` column. No floats anywhere.
2. **One currency (USD) in v1.** Multi-currency is out of scope. Amounts are plain integer cents with no currency column. Since 2026-10-16 the Portuguese interface LABELS them R$ (see "Languages"); nothing is converted.
3. **Sign convention:** `amount_cents` is always positive; `type` (`income` | `expense`) carries direction. A `CHECK (amount_cents > 0)` enforces it.
4. **Dates:** a transaction has a calendar `date` (type `DATE`, no time zone). Periods are half-open: `[start, end)`, e.g. `2026-10-01` <= d < `2026-11-01`.
5. **Net cash flow** = income - expenses for the period. It is not an account balance.
6. **Budget spending** = sum of expense transactions in the budget's category and period. Income never counts.
7. **Deleting a transaction** is a hard delete in v1 (no soft delete, no audit trail). Summaries are computed from live data, so they update automatically. Revisit if auditability becomes a requirement.
8. **User ownership (security invariant):** every transaction, category, and budget belongs to a user, and every query is scoped by `user_id` on the server. Authentication alone is not enough.

## Architecture (planned layers)

```
React UI  ->  Express routes  ->  services (business rules)  ->  repositories (SQL)  ->  PostgreSQL
              (auth, validation)
```

- Routes: HTTP concerns only (parse, validate, status codes).
- Services: financial logic and authorization checks.
- Repositories: all SQL, always scoped by `user_id`.
- Dashboard, budgets, and reports all call the same aggregation functions so numbers cannot diverge.

## Proposed data model (draft)

- `users(id, email UNIQUE, password_hash, created_at)`
- `categories(id, user_id, name, UNIQUE(user_id, name))`
- `transactions(id, user_id, category_id, type, amount_cents, date, description, created_at)`
- `budgets(id, user_id, category_id, period_start, period_end, limit_cents)`

## Authentication (ACCEPTED)

- **Server-side sessions in PostgreSQL**, delivered via an HTTP-only cookie. Rejected: JWTs (harder revocation; browser-storage XSS exposure; our backend is first-party so we don't need their distributed benefits).
- Cookie holds a random 32-byte token; DB stores only `sha256(token)`.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production; idle and absolute expiry.
- CSRF: `SameSite=Lax` + `Origin` header check on state-changing requests.
- Passwords: argon2id. Failed logins are rate-limited; "no such user" and "wrong password" return the same error.
- **Same-site deployment** (dev: Vite proxies `/api` to Express; prod: one domain or reverse proxy). Platform choice deferred.

## Budgets (Phase 2, ACCEPTED)

- Monthly budgets only. One budget per (user, category, month); `month` stored as the first day of the month.
- Spending = SUM of **expense** transactions for the user and category with date in `[month_start, next_month_start)`, computed in SQL (`repositories/spending.ts`, the single definition; Dashboard and Reports build on it). Income never counts.
- `remaining = limit - spent`; negative means over budget and is shown, not hidden.
- API: `GET /api/budgets?month=YYYY-MM`, `PUT /api/budgets` (create-or-replace), `DELETE /api/budgets/:id`. Ownership as for transactions (404 for others' records, composite FK for categories).
- A category used by transactions OR budgets cannot be deleted (DB foreign key; API returns 409).
- Dates and months are restricted to years 1900-2099 (PostgreSQL has no year 0).

## Reports (Phase 4, ACCEPTED)

- Period = inclusive range of whole months (`from=YYYY-MM&to=YYYY-MM`), converted to the half-open `[first day of from, first day after to)`. At most 60 months (count of calendar months included); `from > to` and bad formats are 400. Day-level custom ranges deferred.
- `GET /api/reports/spending-by-category`: expenses per category, largest first (ties by name), unbudgeted categories included, income excluded. Reuses the shared `spentByCategory` rule.
- `GET /api/reports/over-time`: one bucket per calendar month with income, expenses, net; zero-activity months included (`generate_series` on `timestamp`, cast to date, so time zones cannot shift boundaries). Aggregation in SQL.
- Reconciliation (tests): category rows sum = category total = monthly expense buckets sum = independent query; a one-month report equals that month's Dashboard.
- No chart library: CSS bars beside tables; the tables carry the exact values and every bar has a text label. Zero totals are handled explicitly.
- CSV export deferred (needs escaping of commas, quotes and newlines, plus date/currency format decisions).

## Security hardening (Phase 5, ACCEPTED)

Audit baseline: every query is scoped by `user_id`, inputs are `.strict()` zod schemas, passwords are argon2id, session tokens are stored hashed, errors are generic, and `npm audit --omit=dev` reported 0 vulnerabilities in both packages. Gaps closed in the first batch:

| Gap | Change | Why |
|---|---|---|
| No security headers | `helmet()` (nosniff, HSTS, frame-ancestors, strict default CSP, no `X-Powered-By`) | Cheap defence against clickjacking, MIME sniffing and fingerprinting. The CSP must be revisited if Express ever serves the built frontend. |
| Rate limiter behind a proxy | `TRUST_PROXY=<hops>` sets Express's `trust proxy` | Behind Render every request shows the proxy's IP, so all users would share one 10-attempt bucket. Left unset by default, because trusting `X-Forwarded-For` without a proxy lets clients spoof their IP. |
| Silent localhost fallback | `APP_ORIGIN` is required when `NODE_ENV=production` (startup fails otherwise) | A wrong CSRF origin check must fail loudly, not quietly. |
| Unlimited account creation | `/register` limited to 10 per 15 min per IP (`REGISTER_RATE_LIMIT` overrides; the tests raise it) | Each registration costs an argon2 hash: a cheap CPU-exhaustion and spam vector. |
| PII in logs | Unexpected errors are logged via `safeLogDetails` (name, SQLSTATE, message, stack; never pg's `detail`) | `detail` contains values such as `Key (email)=(a@b.com)`. |
| Expired sessions accumulate | Hourly `deleteExpiredSessions()` | They are already unusable; this only keeps the table small. |
| Idle database connection errors crash the server | `pool.on("error")` logs them (via `safeLogDetails`) and lets the pool replace the connection | In Node an `error` event with no listener is thrown. Managed databases can drop idle connections at any time (restarts, suspend-when-idle). Found by review while comparing external Postgres providers; covered by tests that show a bare `Pool` throws and ours does not. |

Known and accepted for now: rate limits are per IP only (no per-account lockout, so distributed guessing is not stopped); registration reveals whether an email exists (409 vs 201); there is no password reset or email verification.

**Deployment shape (ACCEPTED): one Render web service + a managed PostgreSQL database.** One Express service serves both the built React app and `/api`, so the browser sees a single origin and the `SameSite=Lax` session cookie works without a custom domain. Two separate `*.onrender.com` services would be different sites (the domain is on the public suffix list), so the cookie would not be sent. Separate services under one custom domain would also work, but add DNS and configuration for no benefit here. **Implemented:** `backend/src/frontend.ts` serves `frontend/dist` (override with `FRONTEND_DIST`; nothing is mounted if there is no build, so development is unchanged). Hashed files in `/assets` get a one-year immutable cache; `index.html` is `no-cache`. Unknown `/api/*` paths return JSON 404. Client routes (`/budgets` ...) fall back to `index.html`, but paths with a file extension 404 properly. The default `helmet` CSP was checked against the real build: no inline scripts, fonts are bundled by `@fontsource`, so nothing had to be loosened. `npm start` in `backend/` runs the compiled server. **Still to do:** set `NODE_ENV=production`, `APP_ORIGIN` (https, exact origin) and `TRUST_PROXY` (hop count matching Render's proxy) on the service, and run migrations on deploy.

Startup now validates configuration (`config.ts`): `APP_ORIGIN` must be a bare origin (https in production) and `TRUST_PROXY` a hop count from 1 to 99; anything else stops the server instead of being ignored.

## Deploying to Render (Phase 5, ACCEPTED, not yet deployed)

Defined in `render.yaml` (a Blueprint): one Node web service plus one PostgreSQL 16 database. Facts below come from Render's docs as read on 2026-10-15; check them again before relying on them, because plans and limits change.

- **Database connection:** Render exposes a database to a service as a connection string (`fromDatabase` offers `connectionString`, `user`, `password`, `database`; no separate host or port). So the app accepts `DATABASE_URL` (`db.ts`) and the migration tool reads the same variable. The internal URL is used (private network, optional TLS). The test suite **refuses to run if `DATABASE_URL` is set**, so a production URL can never be pointed at by tests.
- **Migrations** run in the start command (`npm run migrate -- up && npm start`), not in `preDeployCommand`: the docs do not say whether free services support it, and the start command works on every plan. Trade-off: with several instances two could migrate at once; `node-pg-migrate` takes a database lock, and a free service has one instance anyway. `node-pg-migrate` therefore moved from devDependencies to dependencies.
- **`NODE_ENV=production` also applies during the build on Render** (service environment variables are available at build time), so `npm ci` skips devDependencies unless told otherwise. The first deploy failed on exactly this (`Cannot find type definition file for 'vite/client'`: Vite was not installed). The build command therefore uses `npm ci --include=dev` for both apps. An earlier version of this note claimed the opposite; it was wrong, and the failed deploy log is the evidence.
- **`APP_ORIGIN`** falls back to `RENDER_EXTERNAL_URL` (the service's own https URL), so the first deploy needs no manual value. Set `APP_ORIGIN` explicitly when a custom domain is added.
- **Health check:** `/health` queries PostgreSQL, so a release that cannot reach the database is not promoted.
- **Free plan consequences:** the web service sleeps after 15 minutes of no traffic (about a minute to wake) and has 750 instance hours per month; the free database **expires 30 days after creation** (14-day grace period, then deleted) and has **no backups**. Acceptable for a portfolio demo; use a paid database plan to keep data. This is the owner's cost decision, not mine.
- **`TRUST_PROXY=3` (measured on the live service, 2026-10-15).** Render documents no official hop count, and a wrong number lets clients spoof their IP and dodge the rate limits, so it was left unset for the first deploy (all users then share one bucket, safe but one person's failed logins lock everyone out). Responses carry `Server: cloudflare`, so Cloudflare sits in front of Render's own proxy. Evidence with `TRUST_PROXY=3`: (1) **Not spoofable:** 11 failed logins from one machine, each with a different fake `X-Forwarded-For`, gave ten 401s then a 429, so the fake header never chose the bucket. (2) **Per client, not shared:** after that exhausted this machine's bucket, a login attempt from a phone on mobile data got the normal "invalid email or password" answer instead of 429. What is **not** established: that 3 is the *smallest* value that works (1 and 2 were not tried), and that Cloudflare or Render will keep discarding client-supplied `X-Forwarded-For` headers; the first conclusion rests on one observation, not on Render's documentation. Re-run both tests whenever Render's edge changes or a custom domain is added: send 11 failed logins (random email and password) with a different fake `X-Forwarded-For` each, expecting ten 401 then one 429; then try one login from a different network, expecting 401, not 429.

Verified locally (not on Render): migrations through `DATABASE_URL` on an empty database, boot with `NODE_ENV=production` and only `RENDER_EXTERNAL_URL`, `/health` ok, the app page served, the session cookie `HttpOnly; Secure; SameSite=Lax`, and a request with a foreign `Origin` rejected with 403.

## Visual design: warm light restyle (implemented 2026-10-17, pending owner review)

- **What:** the app moves from a dark indigo/neon look to a warm, light "paper" style from the owner's mockup: soft white cards with large radii, Instrument Serif headlines, Inter for text and labels, sage green as the accent. Dark mode stays as a muted warm variant, no longer the default.
- **Dashboard:** adds a spending-by-category donut (selected month) and a net-cash-flow bar chart (that month and the five before). Both reuse the existing report endpoints, so there are no new server calculations and the same definitions as Reports. Clicking a bar switches the month.
- **Chart colours:** the mockup's pastels failed the colour-blind separation and lightness checks, so six slightly deeper colours were chosen and validated (light and dark separately). A category keeps its colour across months (stable hash of its id; colour follows the category, not its rank). With more than six categories, the smallest are summed into "Other"; slices always add up to the category total.
- **Shares are floored** (existing `formatShare`), so legend percentages can add up to slightly less than 100%; the dashboard says so instead of adjusting numbers to force 100.
- **Saved appearance settings:** storage version 3. The saved mode and fonts from older versions are ignored (they were always saved, so they were the old defaults rather than choices); saved colour overrides are kept.
- **Rejected from the mockup:** the "extrato importado" badge (bank imports are out of V1 scope) and the savings insight card (new comparison logic plus a projection, close to forecasting). Portuguese/BRL is not part of this change; see Open items.

## Languages: en-US and pt-BR (implemented 2026-10-16, ACCEPTED by owner incl. the R$ risk)

- **What:** the whole interface is available in English (US) and Portuguese (Brazil). A picker in the account menu (Options) and on the login, register and change-password pages switches it instantly.
- **Where the choice lives:** this browser's localStorage (`moneta.lang`), like the theme, so it is per device and works before signing in. First visit: any `pt*` browser language picks pt-BR, everything else en-US. A stored value is validated before use. Rejected: saving it on the user profile (needs a migration and an endpoint, and the login page would still need the browser fallback).
- **Currency label follows the language (owner's decision, known risk):** pt-BR shows `R$ 1.234,56`, en-US `$1,234.56`, for the SAME stored cents. No conversion happens. **Risk:** the label is not a property of the data. Amounts entered as dollars read as reais after switching to Portuguese (and vice versa), and two devices with different languages show the same account in two currencies. The recommended alternative was to keep USD in both languages (`US$ 1.234,56` in pt-BR); a per-user currency (`users.currency`, chosen once) is the correct fix if BRL becomes a real requirement. Form labels follow the same rule ("Amount (USD)" / "Valor (R$)"). The Portuguese footer therefore says "centavos inteiros" instead of naming a currency.
- **Formatting:** integer/string operations only (no float, no `Intl.NumberFormat` for money), so output is exact and identical in every browser. pt-BR uses "." for thousands, "," for decimals, a no-break space after "R$", and "mil" for thousands in chart labels. Month names come from the browser's `Intl` data ("outubro de 2026"; capitalised in headings).
- **Input:** unchanged. Amount fields accept "12,34" and "12.34" in both languages and still reject thousands separators ("1.234,56", "1.234") rather than guess. Edit forms pre-fill with the language's decimal separator.
- **Not translated by the app:** native date/month inputs (the browser draws them in its own language), transaction dates (still ISO `YYYY-MM-DD`, unambiguous), user data such as category names, and font names.
- **API errors:** every error response is `{ error, code }` (code list: `backend/src/errors.ts`, mirrored in `frontend/src/i18n/messages.ts`). The client translates by code; English shows the server's message (often more specific, e.g. which field failed), and an unknown code falls back to that message. Codes must never change meaning once shipped. The auth rate limiter now answers with the same JSON shape (`RATE_LIMITED`) instead of plain text.
- **Implementation:** no i18n library. `frontend/src/i18n/messages.ts` holds both dictionaries; `pt` is typed as `typeof en`, so a missing or extra key fails `npm run typecheck`, and a unit test also compares the runtime shape. Formatting helpers take the language as an explicit argument (`formatCents(cents, lang)`) instead of reading global state, so tests don't depend on the machine's locale. Rejected: react-i18next (a dependency, string keys without compile-time checking, more than two languages need).

## Open items

- (Resolved) Migrations: `node-pg-migrate` via CLI, plain `.sql` files in `db/migrations` with `-- Up Migration` / `-- Down Migration` markers. Applied with `npm run migrate -- up` from `backend/`. Postgres no longer auto-runs them. Applied migrations are tracked in the `pgmigrations` table. Never edit an applied migration; add a new one.
- Migration tool (e.g. node-pg-migrate) and query layer (raw `pg` vs. a query builder).
- Test framework (Vitest/Jest + Supertest) and local Postgres setup (Docker).
- Deployment target.
- Name availability and trademark check for "Moneta".
- (Resolved 2026-10-16, see "Languages") Portuguese + BRL: the language is per browser; R$ is a display label tied to the language (owner accepted the mislabelling risk). Still open: a real per-user currency if BRL data must be distinguished from USD data.
