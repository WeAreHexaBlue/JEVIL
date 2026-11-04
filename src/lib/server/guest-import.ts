/**
 * Guest → account import (SPEC §10.5). A signed-in user may hand the browser's
 * guest rows to the server once; only hosted cloud keys are imported. Local
 * endpoints stay in the browser because the server cannot reach them.
 */

import { guestConnectionSchema, type GuestConnection } from "#lib/schema/guest";
import type { ProviderId } from "#lib/schema/primitives";

export const IMPORT_MAX_ENTRIES = 20;
export const IMPORT_MAX_BYTES = 128 * 1024;

export interface GuestImport {
    connections: GuestConnection[];
    /** Entries that were invalid or local, and stay in the browser. */
    skipped: number;
}

/**
 * Parse the JSON a client posted. Returns null when nothing can be imported;
 * never throws on hostile input.
 */
export const parseGuestImport = (raw: string): GuestImport | null => {
    if (!raw || raw.length > IMPORT_MAX_BYTES) return null;

    let entries: unknown;
    try {
        entries = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!Array.isArray(entries) || entries.length === 0) return null;
    if (entries.length > IMPORT_MAX_ENTRIES) return null;

    const connections: GuestConnection[] = [];
    for (const entry of entries) {
        const parsed = guestConnectionSchema.safeParse(entry);
        if (parsed.success && parsed.data.mode === "cloud") {
            connections.push(parsed.data);
        }
    }

    return connections.length > 0
        ? { connections, skipped: entries.length - connections.length }
        : null;
};

export interface GuestConnectionInput {
    provider: ProviderId;
    label: string;
    baseUrl: string;
    model?: string;
    secret: string;
    config: Record<string, string>;
}

/** Map a validated cloud guest row to the account connection input. */
export const guestConnectionInput = (guest: GuestConnection): GuestConnectionInput => {
    const config: Record<string, string> = {};
    if (guest.accountId) config.accountId = guest.accountId;
    if (guest.headerName) config.headerName = guest.headerName;

    return {
        provider: guest.provider,
        label: guest.label,
        baseUrl: guest.baseUrl,
        model: guest.model,
        secret: guest.secret ?? "",
        config
    };
};
