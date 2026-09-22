import { randomBytes } from "node:crypto";

/**
 * Short, non-guessable reference shown to the person and printed in the server log,
 * so a support message ("it said reference 9f2c1a") can be tied to one log line.
 */
export function newCorrelationId(): string {
  return randomBytes(6).toString("hex");
}

/** The diagnostic fields node-postgres attaches to a database error. */
type DatabaseErrorFields = {
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  routine?: string;
  detail?: string;
};

function databaseFields(error: unknown): DatabaseErrorFields {
  if (!error || typeof error !== "object") return {};
  const source = error as Record<string, unknown>;
  const pick = (key: keyof DatabaseErrorFields): string | undefined =>
    typeof source[key] === "string" && source[key] ? (source[key] as string) : undefined;
  return {
    code: pick("code"),
    constraint: pick("constraint"),
    table: pick("table"),
    column: pick("column"),
    routine: pick("routine"),
    detail: pick("detail"),
  };
}

export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Record a server fault and return the reference to show the caller.
 *
 * Development logs the database code, constraint, `detail` and the stack, which is what
 * makes a failure like a rejected claim actually diagnosable. Production logs the same
 * structural fields but omits `detail` and the stack, because PostgreSQL's `detail`
 * echoes the offending row values and those can carry a person's email address.
 *
 * `context` is for identifiers the operator needs (slug, claim id, action). Never pass a
 * token, secret, challenge value, session id or email address.
 */
export function reportServerError(scope: string, error: unknown, context: ErrorContext = {}): string {
  const correlationId = newCorrelationId();
  const development = process.env.NODE_ENV !== "production";
  const fields = databaseFields(error);
  const parts: string[] = [`scope=${scope}`, `ref=${correlationId}`];

  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) parts.push(`${key}=${String(value)}`);
  }
  for (const key of ["code", "constraint", "table", "column", "routine"] as const) {
    if (fields[key]) parts.push(`${key}=${fields[key]}`);
  }
  if (error instanceof Error) parts.push(`message=${error.message}`);
  if (development && fields.detail) parts.push(`detail=${fields.detail}`);

  console.error(parts.join(" "));
  if (development && error instanceof Error && error.stack) console.error(error.stack);
  return correlationId;
}

/**
 * Body for a 500 response. The message stays friendly; the reference is what ties it
 * to the server log. Never put the raw error text in here -- it reaches the browser.
 */
export function faultBody(message: string, correlationId: string): { error: string; correlationId: string } {
  return { error: message, correlationId };
}
