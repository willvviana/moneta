import { Pool } from "pg";
import { safeLogDetails } from "./errors.js";

// Connection settings come from the environment, so no secret appears in code:
//  - DATABASE_URL (one connection string) when set, e.g. on Render, which provides the database that way;
//  - otherwise the standard PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE variables, which Pool reads itself.
// A pool reuses connections instead of opening one per request.
export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool();

// A connection that sits idle in the pool can be closed by the database or the network (a restart,
// a managed database that suspends when idle). pg then emits "error" on the pool. In Node an "error"
// event with no listener is thrown, which would crash the whole server. With a listener the broken
// connection is simply discarded and the next query gets a fresh one.
pool.on("error", (err) => console.error("Idle database connection error:", safeLogDetails(err)));
