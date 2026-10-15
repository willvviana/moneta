import { app } from "./app.js";
import { deleteExpiredSessions } from "./repositories/sessions.js";

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Moneta API listening on :${port}`));

// Clean up expired sessions once an hour. unref() so this timer never keeps the process alive.
setInterval(
  () => void deleteExpiredSessions().catch((err) => console.error("Session cleanup failed:", err instanceof Error ? err.message : err)),
  60 * 60 * 1000,
).unref();
