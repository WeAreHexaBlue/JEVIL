import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    return { q };
};
