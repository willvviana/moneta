import { Pool } from "pg";

// Pool reads PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE from the
// environment automatically, so no connection string (and no secret)
// appears in code. A pool reuses connections instead of opening one per request.
export const pool = new Pool();
