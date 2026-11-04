<script lang="ts">
    import { resolve } from "$app/paths";
    import { defaultBenchValues } from "#lib/decide/bench";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import { errorClass, inputClass, labelClass } from "#lib/components/field-styles";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

    const values = $derived.by(() => {
        if (!form || !("values" in form) || !form.values) return undefined;
        return form.values;
    });

    const failure = $derived.by(() => {
        if (!form || !("error" in form) || !form.error) return null;
        return form.error;
    });

    const result = $derived.by(() => {
        if (!form || !("result" in form) || !form.result) return undefined;
        return form.result;
    });

    const latency = $derived.by(() => {
        if (!form || !("latency" in form)) return undefined;
        return form.latency;
    });

    const tokens = $derived.by(() => {
        if (!result?.usage) return 0;
        if (result.usage.billed_tokens !== undefined) return result.usage.billed_tokens;
        return (result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0);
    });

    const defaults = defaultBenchValues;
</script>

<svelte:head>
    <title>{m.bench_title()} — JEVIL</title>
    <meta name="description" content={m.bench_sub()} />
</svelte:head>

<section class="container-page py-12 md:py-16">
    <a
        href={resolve("/settings/connections")}
        class="text-small font-semibold text-brand underline underline-offset-4 hover:text-ink"
    >
        ← {m.bench_back()}
    </a>

    <h1 class="mt-4 text-h1">{m.bench_title()}</h1>
    <p class="mt-2 max-w-xl text-body text-ink-2">{m.bench_sub()}</p>
    <p class="mt-1 font-mono text-micro text-muted">
        {data.connection.label} · {data.connection.provider}
        {#if data.connection.model}· {data.connection.model}{/if}
    </p>

    {#if failure}
        <p class="{errorClass} mt-6" role="alert">{failure}</p>
    {/if}

    <form method="POST" action="?/run" class="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div class="flex flex-col gap-6">
            <div class="rounded-lg border border-line bg-paper p-5">
                <label for="state" class={labelClass}>{m.bench_state()}</label>
                <textarea
                    id="state"
                    name="state"
                    rows="5"
                    required
                    class="{inputClass} mt-2 h-auto py-3"
                    placeholder="a moody forest at dusk">{values?.state ?? defaults.state}</textarea
                >
                <p class="mt-1.5 text-micro text-muted">{m.bench_state_hint()}</p>
            </div>

            <fieldset class="rounded-lg border border-line bg-paper p-5">
                <legend class="px-1 text-h3">{m.bench_choice()}</legend>
                <div class="mt-2 flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label for="choiceInstructions" class={labelClass}>
                            {m.bench_instructions()}
                        </label>
                        <input
                            id="choiceInstructions"
                            name="choiceInstructions"
                            value={values?.choiceInstructions ?? defaults.choiceInstructions}
                            class={inputClass}
                        />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label for="choiceOptions" class={labelClass}>{m.bench_options()}</label>
                        <textarea
                            id="choiceOptions"
                            name="choiceOptions"
                            rows="2"
                            class="{inputClass} h-auto py-3"
                            >{values?.choiceOptions ?? defaults.choiceOptions}</textarea
                        >
                        <p class="text-micro text-muted">{m.bench_choice_hint()}</p>
                    </div>
                </div>
            </fieldset>

            <fieldset class="rounded-lg border border-line bg-paper p-5">
                <legend class="px-1 text-h3">{m.bench_score()}</legend>
                <div class="mt-2 flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label for="scoreInstructions" class={labelClass}>
                            {m.bench_instructions()}
                        </label>
                        <input
                            id="scoreInstructions"
                            name="scoreInstructions"
                            value={values?.scoreInstructions ?? defaults.scoreInstructions}
                            class={inputClass}
                        />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label for="scoreLevels" class={labelClass}>{m.bench_levels()}</label>
                        <textarea
                            id="scoreLevels"
                            name="scoreLevels"
                            rows="2"
                            class="{inputClass} h-auto py-3"
                            >{values?.scoreLevels ?? defaults.scoreLevels}</textarea
                        >
                        <p class="text-micro text-muted">{m.bench_score_hint()}</p>
                    </div>
                </div>
            </fieldset>

            <fieldset class="rounded-lg border border-line bg-paper p-5">
                <legend class="px-1 text-h3">{m.bench_noul()}</legend>
                <div class="mt-2 flex flex-col gap-1.5">
                    <label for="noulInstructions" class={labelClass}>
                        {m.bench_instructions()}
                    </label>
                    <input
                        id="noulInstructions"
                        name="noulInstructions"
                        value={values?.noulInstructions ?? defaults.noulInstructions}
                        class={inputClass}
                    />
                    <p class="text-micro text-muted">{m.bench_noul_hint()}</p>
                </div>
            </fieldset>

            <Button type="submit" size="lg">{m.bench_run()}</Button>
        </div>

        <div class="rounded-lg border border-line bg-paper-2/50 p-5 lg:sticky lg:top-24">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 class="text-h3">{m.bench_result()}</h2>
                {#if latency !== undefined}
                    <p class="font-mono text-micro text-muted">
                        {m.bench_latency({ ms: String(latency) })}
                        {#if tokens > 0}
                            · {m.bench_tokens({ tokens: String(tokens) })}
                        {/if}
                    </p>
                {/if}
            </div>

            {#if result}
                <pre
                    class="mt-3 max-h-[32rem] overflow-auto rounded-sm bg-night p-4 font-mono text-micro whitespace-pre-wrap text-on-night">{JSON.stringify(
                        result,
                        null,
                        2
                    )}</pre>
            {:else}
                <p class="mt-3 text-small text-muted">{m.bench_empty()}</p>
            {/if}
        </div>
    </form>
</section>
