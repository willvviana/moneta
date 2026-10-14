# Proves migrations reproduce your real database's schema.
# Run from the repo root:  op run --env-file=.env.op -- powershell -File scripts\verify-migrations.ps1
# Prerequisite: the dev DB ("moneta") is already baselined with `npm run migrate -- up --fake`.
# Steps: build a scratch DB from migrations only -> dump both schemas -> diff -> drop scratch.

function Exec { & $args[0] $args[1..($args.Length - 1)]; if ($LASTEXITCODE -ne 0) { throw "failed: $args" } }
function DbSql($sql) { Exec docker compose exec -T db psql -U moneta -d postgres -v ON_ERROR_STOP=1 -c $sql }
# Schema-only dump; drop pg_dump's per-run random "\restrict" lines so dumps are comparable.
function Dump($db) { docker compose exec -T db sh -c "pg_dump -U moneta -s $db | grep -v restrict" }

DbSql "DROP DATABASE IF EXISTS moneta_verify"
DbSql "CREATE DATABASE moneta_verify"

$original = $env:PGDATABASE
$env:PGDATABASE = "moneta_verify"
Push-Location backend
# Call the tool via node directly: PowerShell's npm.ps1 wrapper mishandles the "--" argument.
try { Exec node node_modules\node-pg-migrate\bin\node-pg-migrate.js --migrations-dir ../db/migrations --migration-file-language sql up }
finally { Pop-Location; $env:PGDATABASE = $original }

# Sanity check: refuse to compare unless both migrations were really applied to the scratch DB.
$applied = (docker compose exec -T db psql -U moneta -d moneta_verify -tA -c "SELECT count(*) FROM pgmigrations").Trim()
if ($applied -ne "2") { DbSql "DROP DATABASE moneta_verify"; throw "expected 2 applied migrations in moneta_verify, found '$applied'" }

$diff = Compare-Object (Dump "moneta") (Dump "moneta_verify")
DbSql "DROP DATABASE moneta_verify"

if ($diff) { Write-Host "FAIL: schemas differ"; $diff | Format-Table -AutoSize; exit 1 }
Write-Host "PASS: fresh database built from migrations matches the dev database schema"
