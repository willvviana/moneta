// Runs before every test file. SAFETY GATE: refuse to run unless the target
// database is explicitly a test database, so tests can never touch dev data.
const db = process.env.PGDATABASE ?? "";
if (db !== "moneta_test") {
  throw new Error(
    `Refusing to run tests: PGDATABASE is "${db}", expected "moneta_test". ` +
      `Run with: op run --env-file=../.env.testdb.op -- npm test`,
  );
}
