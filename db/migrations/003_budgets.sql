-- Up Migration
-- Monthly budgets: one spending limit per (user, category, month).
CREATE TABLE budgets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL,
  -- Always the FIRST day of the month, so "March 2026" has exactly one representation.
  month       DATE   NOT NULL CHECK (month = date_trunc('month', month)::date),
  limit_cents BIGINT NOT NULL CHECK (limit_cents > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A category can't have two budgets in the same month (also what the upsert targets).
  UNIQUE (user_id, category_id, month),
  -- Same trick as transactions: the category must belong to the SAME user.
  -- NO ACTION also means a category with a budget cannot be deleted (API reports 409).
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id)
);

-- "All budgets for this user in this month".
CREATE INDEX budgets_user_month_idx ON budgets (user_id, month);

-- Down Migration
DROP TABLE budgets;
