/**
 * Provider registry. Routes resolve a connection's provider id here; adding a
 * provider means adding one adapter and one entry.
 */

import type { ProviderId } from "#lib/schema/primitives";
import type { DecideAdapter } from "./base";
import { clefAdapter } from "./clef";
import { cloudflareAdapter } from "./cloudflare";
import { jevAdapter } from "./jev";
import { layaAdapter } from "./laya";
import { systemoneAdapter } from "./systemone";

export const adapters: Record<ProviderId, DecideAdapter> = {
    jev: jevAdapter,
    laya: layaAdapter,
    clef: clefAdapter,
    cloudflare: cloudflareAdapter,
    systemone: systemoneAdapter
};

export const adapterList: DecideAdapter[] = Object.values(adapters);

export const getAdapter = (provider: ProviderId): DecideAdapter => adapters[provider];

export * from "./base";
export { clefAdapter, cloudflareAdapter, jevAdapter, layaAdapter, systemoneAdapter };
