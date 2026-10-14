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

// PostgreSQL SQLSTATE of a thrown pg error, e.g. "23505" unique_violation,
// "23503" foreign_key_violation.
export const pgErrorCode = (err: unknown): string | undefined => (err as { code?: string } | null)?.code;
