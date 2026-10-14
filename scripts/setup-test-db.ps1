# (Re)creates the throwaway test database from migrations.
# Run from the repo root:  op run --env-file=.env.testdb.op -- powershell -File scripts\setup-test-db.ps1
function Exec { & $args[0] $args[1..($args.Length - 1)]; if ($LASTEXITCODE -ne 0) { throw "failed: $args" } }

# Safety: this script DROPS a database, so it only ever acts on the test database.
if ($env:PGDATABASE -ne "moneta_test") { throw "PGDATABASE must be moneta_test (got '$env:PGDATABASE')" }

Exec docker compose exec -T db psql -U moneta -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS moneta_test"
Exec docker compose exec -T db psql -U moneta -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE moneta_test"

Push-Location backend
try { Exec node node_modules\node-pg-migrate\bin\node-pg-migrate.js --migrations-dir ../db/migrations --migration-file-language sql up }
finally { Pop-Location }
Write-Host "moneta_test is ready"
