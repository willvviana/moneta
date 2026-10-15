-- Up Migration
-- Category names are unique per user IGNORING CASE ("Bill" and "bill" are the same category).
-- Display casing is preserved; only the uniqueness check ignores case.

-- Guard: a unique index can't be built over existing case-only duplicates, so stop with a
-- readable message (listing them) before touching anything. The migration runs in a
-- transaction, so a failure here changes nothing.
DO $$
DECLARE
  dup text;
BEGIN
  SELECT string_agg(format('user %s: %s', user_id, names), '; ')
    INTO dup
    FROM (
      SELECT user_id, string_agg(id || ':' || name, ' / ') AS names
        FROM categories
       GROUP BY user_id, lower(name)
      HAVING count(*) > 1
    ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Case-insensitive duplicate category names exist; rename or merge them first: %', dup;
  END IF;
END
$$;

-- Replaces the case-sensitive UNIQUE (user_id, name) from 001.
ALTER TABLE categories DROP CONSTRAINT categories_user_id_name_key;
CREATE UNIQUE INDEX categories_user_lower_name_key ON categories (user_id, lower(name));

-- Down Migration
DROP INDEX categories_user_lower_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name);
