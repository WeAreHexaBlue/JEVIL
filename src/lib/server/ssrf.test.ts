import { describe, expect, it } from "vitest";
import { checkEndpointUrl, type EndpointPolicy } from "./ssrf";

const dev: EndpointPolicy = { production: false, allowLocal: true };
const noLocal: EndpointPolicy = { production: false, allowLocal: false };
const prod: EndpointPolicy = { production: true, allowLocal: false };

const allowed = (raw: string, policy: EndpointPolicy): boolean => checkEndpointUrl(raw, policy).ok;

describe("checkEndpointUrl", () => {
    it("accepts a normal https endpoint on 443 or 8443", () => {
        expect(allowed("https://api.layaaimodel.com", prod)).toBe(true);
        expect(allowed("https://proxy.test:8443/v1", prod)).toBe(true);
    });

    it("rejects plain http for remote hosts", () => {
        expect(allowed("http://api.layaaimodel.com", dev)).toBe(false);
        expect(checkEndpointUrl("http://api.layaaimodel.com", dev)).toMatchObject({
            ok: false,
            problem: "scheme"
        });
    });

    it("allows loopback over http only while local endpoints are enabled", () => {
        expect(allowed("http://localhost:8000", dev)).toBe(true);
        expect(allowed("http://127.0.0.1:8000", dev)).toBe(true);
        expect(allowed("http://[::1]:8000", dev)).toBe(true);

        expect(allowed("http://localhost:8000", noLocal)).toBe(false);
        expect(allowed("http://localhost:8000", prod)).toBe(false);
        expect(checkEndpointUrl("http://localhost:8000", prod)).toMatchObject({
            ok: false,
            problem: "local"
        });
    });

    it("rejects a loopback host over https in production", () => {
        expect(allowed("https://localhost:8443", dev)).toBe(true);
        expect(allowed("https://localhost:8443", prod)).toBe(false);
    });

    it("rejects credentials, fragments, and unsupported schemes", () => {
        expect(checkEndpointUrl("https://user:pass@example.com", prod)).toMatchObject({
            problem: "credentials"
        });
        expect(checkEndpointUrl("https://example.com/#frag", prod)).toMatchObject({
            problem: "fragment"
        });
        expect(checkEndpointUrl("ftp://example.com", prod)).toMatchObject({ problem: "scheme" });
        expect(checkEndpointUrl("not a url", prod)).toMatchObject({ problem: "invalid" });
    });

    it("rejects remote ports outside the allowlist", () => {
        expect(checkEndpointUrl("https://example.com:8080", prod)).toMatchObject({
            problem: "port"
        });
        expect(checkEndpointUrl("https://example.com:80", prod)).toMatchObject({
            problem: "port"
        });
    });

    const privateV4 = [
        "https://10.0.0.5",
        "https://127.0.0.1",
        "https://169.254.169.254",
        "https://192.168.1.10",
        "https://172.16.0.1",
        "https://100.64.0.1",
        "https://0.0.0.0",
        "https://224.0.0.1"
    ];

    for (const url of privateV4) {
        it(`rejects the private IPv4 literal ${url}`, () => {
            expect(allowed(url, prod)).toBe(false);
        });
    }

    it("rejects private, mapped, and metadata IPv6 hosts", () => {
        expect(checkEndpointUrl("https://[fc00::1]", prod)).toMatchObject({ problem: "host" });
        expect(checkEndpointUrl("https://[fe80::1]", prod)).toMatchObject({ problem: "host" });
        expect(checkEndpointUrl("https://[::ffff:127.0.0.1]", prod)).toMatchObject({
            problem: "host"
        });
    });

    it("rejects internal hostnames", () => {
        expect(checkEndpointUrl("https://metadata.google.internal", prod)).toMatchObject({
            problem: "host"
        });
        expect(checkEndpointUrl("https://printer.local", prod)).toMatchObject({ problem: "host" });
        expect(checkEndpointUrl("https://db.internal", prod)).toMatchObject({ problem: "host" });
    });

    it("returns the parsed URL for a valid endpoint", () => {
        const result = checkEndpointUrl("https://example.com/v1/", dev);
        expect(result.ok && result.url.pathname).toBe("/v1/");
    });
});
