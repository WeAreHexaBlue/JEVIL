/**
 * Display names for provider ids. The id is the contract; this is only copy.
 * Kept out of the server adapter registry so client components can use it.
 */

const NAMES: Record<string, string> = {
    jev: "Jev",
    laya: "Laya",
    clef: "Clef",
    cloudflare: "Cloudflare",
    systemone: "System One"
};

export const providerName = (provider: string): string => NAMES[provider] ?? provider;
