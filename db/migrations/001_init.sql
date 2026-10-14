-- Up Migration
-- Moneta initial schema. See docs/DECISIONS.md for the rules enforced here.

CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: Bob@x.com and bob@x.com are the same user.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TABLE categories (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL CHECK (length(trim(name)) > 0),
  UNIQUE (user_id, name),
  -- Needed so transactions can reference (id, user_id) as a composite FK.
  UNIQUE (id, user_id)
);

CREATE TABLE transactions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  BIGINT NOT NULL,
  type         TEXT   NOT NULL CHECK (type IN ('income', 'expense')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  date         DATE   NOT NULL,
  description  TEXT   NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Composite FK: the category must belong to the SAME user as the transaction.
  -- Blocks user A from linking a transaction to user B's category.
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id)
);

-- Most queries filter by user and a date range.
CREATE INDEX transactions_user_date_idx ON transactions (user_id, date);

-- Down Migration
DROP TABLE transactions;
DROP TABLE categories;
DROP TABLE users;
