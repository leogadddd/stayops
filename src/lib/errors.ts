import "server-only";

import { unstable_rethrow } from "next/navigation";

// Postgres error codes that mean the code and database schema disagree,
// usually because a migration hasn't been run after a schema change.
const SCHEMA_MISMATCH_CODES = new Set([
  "42703", // undefined_column
  "42P01", // undefined_table
  "42704", // undefined_object (e.g. a missing enum type)
]);

function postgresCode(error: unknown): string | undefined {
  // Drizzle wraps driver errors in DrizzleQueryError with the original as cause.
  for (let current = error; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Last-resort handler for server actions: logs an error the action didn't
 * anticipate (a failed query, a lost connection) and returns a message the
 * form can show instead of crashing the page. Next.js control-flow errors
 * such as redirect() and notFound() are rethrown untouched.
 */
export function unexpectedErrorMessage(error: unknown, context: string): string {
  unstable_rethrow(error);
  const code = postgresCode(error);
  console.error(`[${context}] unexpected error`, error);
  if (code && SCHEMA_MISMATCH_CODES.has(code) && process.env.NODE_ENV !== "production") {
    return "The database schema is out of date. Run `npm run db:migrate` and try again.";
  }
  return "Something went wrong on our side. Please try again in a moment.";
}
