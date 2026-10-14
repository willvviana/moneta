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
2. **One currency (USD) in v1.** Multi-currency is out of scope.
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

## Open items

- Password hashing and session vs. JWT (decide in the auth milestone).
- Migration tool (e.g. node-pg-migrate) and query layer (raw `pg` vs. a query builder).
- Test framework (Vitest/Jest + Supertest) and local Postgres setup (Docker).
- Deployment target.
- Name availability and trademark check for "Moneta".
