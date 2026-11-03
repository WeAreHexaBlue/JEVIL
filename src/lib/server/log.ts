import { redact } from "./redact.ts";

export type LogLevel = "info" | "warn" | "error";

/**
 * Write one structured, redacted log line.
 *
 * Workers Logs indexes JSON fields, so keep these shapes stable: `event`,
 * `route`, `status`, `provider`, `errorCode`. Never pass request bodies,
 * headers, model state, or provider payloads; they are stripped anyway, but
 * the call site should not collect them.
 */
export const logEvent = (
    level: LogLevel,
    event: string,
    fields: Record<string, unknown> = {}
): void => {
    const line = {
        ...(redact(fields) as Record<string, unknown>),
        level,
        event
    };

    const write =
        level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    write(JSON.stringify(line));
};
