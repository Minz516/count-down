/**
 * Project-wide typed error hierarchy. Repositories/services throw these;
 * nothing else formats a failure - a component's catch block (or a Next.js
 * `error.tsx` boundary) reads `.message` for display and can branch on
 * `.code` if it ever needs to (e.g. showing a specific field error).
 */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

/** A rule the caller violated before any database call was made (e.g. a missing field). */
export class ValidationError extends AppError {
  constructor(message: string) {
    super("validation_failed", message);
    this.name = "ValidationError";
  }
}

/** The action requires a signed-in user and none was found. */
export class NotAuthenticatedError extends AppError {
  constructor(message = "You must be signed in to do this.") {
    super("not_authenticated", message);
    this.name = "NotAuthenticatedError";
  }
}

/** Supabase (or any other data store) rejected the operation. */
export class DatabaseError extends AppError {
  constructor(message: string) {
    super("database_error", message);
    this.name = "DatabaseError";
  }
}
