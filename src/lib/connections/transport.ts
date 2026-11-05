/**
 * Pick a decide transport for a connection choice.
 *
 * The guest and account paths already share the runner's coded-error shape.
 * This module is the one place that knows which function to call, so the app
 * runner and the editor test bench cannot drift apart.
 */

import type { DecideRequest, DecideResponse } from "#lib/decide/types";
import type { GuestConnection } from "#lib/schema/guest";
import { decideViaAccount } from "./account";
import { decideLocal } from "./local";
import { decideViaProxy } from "./proxy";

export type DecideTransport = (
    request: DecideRequest,
    options: { signal: AbortSignal }
) => Promise<DecideResponse>;

export const accountTransport =
    (connectionId: string): DecideTransport =>
    (request, { signal }) =>
        decideViaAccount(connectionId, request, { signal });

export const guestTransport = (guest: GuestConnection): DecideTransport => {
    if (guest.mode === "local") {
        return (request, { signal }) =>
            decideLocal(
                {
                    baseUrl: guest.baseUrl,
                    model: guest.model,
                    secret: guest.secret,
                    headerName: guest.headerName
                },
                request,
                { signal }
            );
    }

    return (request, { signal }) => decideViaProxy(guest, request, { signal });
};
