-- Up Migration
-- Server-side sessions. The browser holds a random token in an HTTP-only
-- cookie; we store only its SHA-256 hash, so a leaked table can't be replayed.

CREATE TABLE sessions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   BYTEA  NOT NULL UNIQUE,   -- sha256(token); UNIQUE also gives us the lookup index
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL      -- absolute expiry; idle timeout uses last_seen_at
);

-- "Log out everywhere" and cleanup of a user's sessions.
CREATE INDEX sessions_user_idx ON sessions (user_id);
-- Periodic purge of expired rows.
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Down Migration
DROP TABLE sessions;
