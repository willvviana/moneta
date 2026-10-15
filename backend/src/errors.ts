// An error that is safe to show to the client (status + message).
// Anything else that gets thrown is treated as a 500 and NOT leaked.
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// What may be written to logs for an unexpected error. pg errors carry a `detail` such as
// 'Key (email)=(a@b.com) already exists', which would put users' emails into the logs, so we
// log only the error type, the SQLSTATE code and the message, plus the stack.
export function safeLogDetails(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { value: String(err) };
  return { name: err.name, code: pgErrorCode(err), message: err.message, stack: err.stack };
}

// PostgreSQL SQLSTATE of a thrown pg error, e.g. "23505" unique_violation,
// "23503" foreign_key_violation.
export const pgErrorCode = (err: unknown): string | undefined => (err as { code?: string } | null)?.code;
