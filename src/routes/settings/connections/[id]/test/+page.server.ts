import { env, waitUntil } from "cloudflare:workers";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { decideRequestSchema, questionsSchema } from "#lib/decide/types";
import { getKeyRing } from "#lib/server/config";
import {
    getConnection,
    getConnectionRow,
    resolveConnection,
    ConnectionError
} from "#lib/server/connections";
import { CryptoConfigError, DecryptionError } from "#lib/server/crypto";
import { getDb } from "#lib/server/db";
import { addUsage, runDecide, subjectFor, toClientResult } from "#lib/server/decide";
import { ProviderError } from "#lib/server/providers/base";
import { recordUsage } from "#lib/server/rate-limit";
import { logEvent } from "#lib/server/log";

const text = (data: FormData, key: string): string => String(data.get(key) ?? "").trim();

const list = (data: FormData, key: string): string[] => {
    const seen = new Set<string>();
    return String(data.get(key) ?? "")
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter((value) => {
            if (!value || seen.has(value)) return false;
            seen.add(value);
            return true;
        });
};

const valuesOf = (data: FormData) => ({
    state: text(data, "state"),
    choiceInstructions: text(data, "choiceInstructions"),
    choiceOptions: text(data, "choiceOptions"),
    scoreInstructions: text(data, "scoreInstructions"),
    scoreLevels: text(data, "scoreLevels"),
    noulInstructions: text(data, "noulInstructions")
});

const buildQuestions = (data: FormData) => {
    const options = list(data, "choiceOptions").slice(0, 8);
    const levels = list(data, "scoreLevels").slice(0, 10);

    return questionsSchema.parse({
        mood: {
            type: "choice",
            instructions: text(data, "choiceInstructions") || "Pick the closest option.",
            criteria: Object.fromEntries(options.map((option) => [option, option]))
        },
        energy: {
            type: "score",
            instructions: text(data, "scoreInstructions") || "How intense is it?",
            criteria: levels.length >= 2 ? levels : ["quiet", "steady", "loud"]
        },
        spark: {
            type: "noul",
            instructions: text(data, "noulInstructions") || "How much does it spark?"
        }
    });
};

const errorMessage = (failure: unknown): string => {
    if (failure instanceof ProviderError) return `${failure.code}: ${failure.message}`;
    if (failure instanceof ConnectionError) return failure.message;
    if (failure instanceof DecryptionError) return m.connections_error_decrypt();
    if (failure instanceof CryptoConfigError) return m.connections_error_config();
    return m.bench_invalid();
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
    const user = locals.user;
    if (!user) redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);

    try {
        const connection = await getConnection(getDb(env.DB), user.id, params.id);
        return { connection };
    } catch (failure) {
        if (failure instanceof ConnectionError) error(404, "That connection does not exist");
        throw failure;
    }
};

export const actions: Actions = {
    run: async ({ locals, params, request }) => {
        const user = locals.user;
        if (!user) {
            redirect(
                303,
                `/sign-in?next=${encodeURIComponent(`/settings/connections/${params.id}/test`)}`
            );
        }

        const data = await request.formData();
        const values = valuesOf(data);

        let decideRequest: ReturnType<typeof decideRequestSchema.parse>;
        try {
            decideRequest = decideRequestSchema.parse({
                state: values.state,
                questions: buildQuestions(data)
            });
        } catch {
            return fail(400, { error: m.bench_invalid(), values });
        }

        const db = getDb(env.DB);

        try {
            const row = await getConnectionRow(db, user.id, params.id);
            if (!row) throw new ConnectionError("not_found", "That connection does not exist");

            const resolved = await resolveConnection(row, await getKeyRing());
            const started = performance.now();
            const response = await runDecide(resolved, decideRequest, AbortSignal.timeout(20_000));
            const latency = Math.round(performance.now() - started);

            waitUntil(
                recordUsage(db, subjectFor("user", user.id), addUsage(response.usage)).catch(() =>
                    logEvent("warn", "usage_counter_failed")
                )
            );

            return {
                values,
                latency,
                result: toClientResult(response)
            };
        } catch (failure) {
            return fail(502, { error: errorMessage(failure), values });
        }
    }
};
