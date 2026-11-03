/** Extract a Better Auth error code without assuming a specific error class. */
export const authErrorCode = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null) return undefined;

    const body = (error as { body?: unknown }).body;
    if (typeof body === "object" && body !== null && "code" in body) {
        const code = (body as { code?: unknown }).code;
        if (typeof code === "string") return code;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
};
