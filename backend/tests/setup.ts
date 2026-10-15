// Runs before every test file. SAFETY GATE: refuse to run unless the target
// database is explicitly a test database, so tests can never touch dev data.
// The register rate limit (10 / 15 min / IP in production) would block suites that create many users.
// hardening.test.ts sets it back to 10 to test the limiter itself.
process.env.REGISTER_RATE_LIMIT ??= "10000";

// DATABASE_URL would override PGDATABASE (see src/db.ts) and silently point the tests at another database,
// bypassing the check below. Refuse outright.
if (process.env.DATABASE_URL) {
  throw new Error("Refusing to run tests: DATABASE_URL is set. The tests use PGHOST/PGDATABASE=moneta_test only.");
}

const db = process.env.PGDATABASE ?? "";
if (db !== "moneta_test") {
  throw new Error(
    `Refusing to run tests: PGDATABASE is "${db}", expected "moneta_test". ` +
      `Run with: op run --env-file=../.env.testdb.op -- npm test`,
  );
}
