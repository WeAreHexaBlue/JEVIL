/**
 * Endpoint safety (SPEC §10.7).
 *
 * Every user-supplied base URL passes through here before a connection is
 * saved or a request is sent. Workers cannot resolve DNS, so this checks what
 * is knowable at request time: scheme, credentials, fragments, ports, literal
 * IP ranges, and the hostnames that commonly point at internal services.
 * Transport safety (no redirects, timeout, size cap) lives in `fetchJson`.
 */

export type EndpointProblem =
    "invalid" | "scheme" | "credentials" | "fragment" | "port" | "host" | "local";

export interface EndpointPolicy {
    /** Production forbids plain HTTP and any local host. */
    production: boolean;
    /** Mirrors `ALLOW_LOCAL_ENDPOINTS`. */
    allowLocal: boolean;
}

export type EndpointCheck =
    { ok: true; url: URL } | { ok: false; problem: EndpointProblem; message: string };

const REMOTE_PORTS = new Set([443, 8443]);

const MESSAGES: Record<EndpointProblem, string> = {
    invalid: "That endpoint URL is not valid",
    scheme: "Use an https:// endpoint",
    credentials: "Remove the username and password from the URL",
    fragment: "Remove the # fragment from the URL",
    port: "Use port 443 or 8443 for a remote endpoint",
    host: "That host is not allowed",
    local: "Local endpoints are disabled"
};

const denyLocal = (problem: EndpointProblem): EndpointCheck => ({
    ok: false,
    problem,
    message: MESSAGES[problem]
});

const parseIpv4 = (host: string): number[] | null => {
    const parts = host.split(".");
    if (parts.length !== 4) return null;

    const octets: number[] = [];
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const value = Number(part);
        if (value > 255) return null;
        octets.push(value);
    }
    return octets;
};

/** Private, loopback, link-local, CGNAT, multicast, and reserved IPv4 space. */
const isPrivateIpv4 = ([a, b]: number[]): boolean => {
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
};

const parseIpv6 = (host: string): number[] | null => {
    let value = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
    if (value.length === 0) return null;

    // Convert a dotted IPv4 tail into two hex groups.
    const dotted = value.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (dotted) {
        const octets = parseIpv4(dotted[2]);
        if (!octets) return null;
        const high = ((octets[0] << 8) | octets[1]).toString(16);
        const low = ((octets[2] << 8) | octets[3]).toString(16);
        value = `${dotted[1]}${high}:${low}`;
    }

    const halves = value.split("::");
    if (halves.length > 2) return null;

    const parseGroups = (part: string): number[] | null => {
        if (part.length === 0) return [];
        const groups = part.split(":");
        if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
        return groups.map((group) => parseInt(group, 16));
    };

    const left = parseGroups(halves[0]);
    if (!left) return null;

    if (halves.length === 1) return left.length === 8 ? left : null;

    const right = parseGroups(halves[1]);
    if (!right) return null;
    if (left.length + right.length > 7) return null;

    return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
};

const isPrivateIpv6 = (host: string): boolean => {
    const groups = parseIpv6(host);
    if (!groups) return false;

    if (groups.every((group) => group === 0)) return true;
    if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;

    // IPv4-mapped addresses (::ffff:127.0.0.1).
    if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
        const octets = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
        return isPrivateIpv4(octets);
    }

    // fc00::/7 unique local, fe80::/10 link-local, fec0::/10 site-local.
    return (
        (groups[0] & 0xfe00) === 0xfc00 ||
        (groups[0] & 0xffc0) === 0xfe80 ||
        (groups[0] & 0xffc0) === 0xfec0
    );
};

const LOCAL_HOSTNAMES = new Set([
    "localhost",
    "metadata",
    "metadata.google.internal",
    "instance-data",
    "kubernetes.default",
    "kubernetes.default.svc"
]);

const isLocalHost = (hostname: string): boolean => {
    const host = hostname.toLowerCase();

    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
    if (host.endsWith(".internal") || LOCAL_HOSTNAMES.has(host)) return true;

    const ipv4 = parseIpv4(host);
    if (ipv4) return isPrivateIpv4(ipv4);
    if (host.includes(":")) return isPrivateIpv6(host);

    return false;
};

const isLocalhostLiteral = (hostname: string): boolean => {
    const host = hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return true;
    if (host === "[::1]") return true;

    const ipv4 = parseIpv4(host);
    return ipv4 !== null && ipv4[0] === 127;
};

/**
 * Check one endpoint URL against the current policy.
 *
 * Remote endpoints must be https on an allowlisted port and must not be a
 * private or metadata host. Plain HTTP is only accepted for loopback hosts and
 * only while local endpoints are enabled, which never holds in production.
 */
export const checkEndpointUrl = (raw: string, policy: EndpointPolicy): EndpointCheck => {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return denyLocal("invalid");
    }

    if (url.username || url.password) return denyLocal("credentials");
    if (url.hash) return denyLocal("fragment");

    const local = isLocalhostLiteral(url.hostname);
    const localAllowed = policy.allowLocal && !policy.production;

    if (url.protocol === "http:") {
        if (!local) return denyLocal("scheme");
        return localAllowed ? { ok: true, url } : denyLocal("local");
    }

    if (url.protocol !== "https:") return denyLocal("scheme");

    if (local) return localAllowed ? { ok: true, url } : denyLocal("local");
    if (isLocalHost(url.hostname)) return denyLocal("host");

    const port = url.port ? Number(url.port) : 443;
    if (!REMOTE_PORTS.has(port)) return denyLocal("port");

    return { ok: true, url };
};

/** Same check, but return the normalized URL or the human-readable problem. */
export const validateEndpointUrl = (
    raw: string,
    policy: EndpointPolicy
): { ok: true; url: string } | { ok: false; message: string } => {
    const result = checkEndpointUrl(raw, policy);
    return result.ok
        ? { ok: true, url: result.url.toString() }
        : { ok: false, message: result.message };
};
