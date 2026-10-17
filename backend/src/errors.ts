// Stable, machine-readable error codes. The client translates by code (the English message is
// only a fallback), so a code must never change meaning once shipped. Keep in sync with
// ErrorCode in frontend/src/i18n/messages.ts.
export type ErrorCode =
  | "VALIDATION"
  | "INVALID_BODY"
  | "NOT_FOUND"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN_ORIGIN"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "INVALID_CREDENTIALS_FORMAT"
  | "INVALID_PASSWORD_CHANGE_FORMAT"
  | "REGISTRATION_FAILED"
  | "INVALID_CREDENTIALS"
  | "INVALID_CURRENT_PASSWORD"
  | "PASSWORD_UNCHANGED"
  | "CATEGORY_UNKNOWN"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_NAME_TAKEN"
  | "CATEGORY_IN_USE"
  | "TRANSACTION_NOT_FOUND"
  | "BUDGET_NOT_FOUND";

// An error that is safe to show to the client (status + code + message).
// Anything else that gets thrown is treated as a 500 and NOT leaked.
export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
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
