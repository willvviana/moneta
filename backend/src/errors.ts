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
