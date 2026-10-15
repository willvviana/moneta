import { Pool } from "pg";

// Connection settings come from the environment, so no secret appears in code:
//  - DATABASE_URL (one connection string) when set, e.g. on Render, which provides the database that way;
//  - otherwise the standard PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE variables, which Pool reads itself.
// A pool reuses connections instead of opening one per request.
export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool();
