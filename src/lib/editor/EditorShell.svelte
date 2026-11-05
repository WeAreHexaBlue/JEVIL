<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import RuntimeApp from "#lib/runtime/components/RuntimeApp.svelte";
    import { createRunner } from "#lib/runtime/runner";
    import {
        validateBlueprint,
        type Blueprint,
        type BlueprintIssue,
        type PropValue
    } from "#lib/schema/blueprint";
    import { appDisplayFromBlueprint, type AppView } from "#lib/schema/app";
    import type { ConnectionView } from "#lib/schema/connection";
    import type { Answer } from "#lib/decide/types";
    import {
        collectNodeIds,
        duplicateNode,
        findNode,
        findParent,
        insertNode,
        moveNode,
        removeInput,
        removeNode,
        rootNodeId,
        setMeta,
        setNodeProp,
        setPreviewAnswers,
        uniqueNodeId,
        upsertInput
    } from "./mutations";
    import { defaultNode, isContainer } from "./defaults";
    import { nodeIdAtPointer } from "./pointers";
    import EditorPalette from "./EditorPalette.svelte";
    import EditorStructure from "./EditorStructure.svelte";
    import EditorInspector from "./EditorInspector.svelte";
    import EditorTestBench from "./EditorTestBench.svelte";

    let {
        app,
        connections
    }: {
        app: AppView;
        connections: ConnectionView[];
    } = $props();

    type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
    type Mode = "design" | "preview" | "json";

    let blueprint = $state<unknown>(untrack(() => structuredClone(app.blueprint)));
    let revision = $state(untrack(() => app.draftRevision));
    let saveState = $state<SaveState>("saved");
    let saveError = $state("");
    let conflictRevision = $state<number | null>(null);
    let mode = $state<Mode>("design");
    let selectedId = $state(untrack(() => rootNodeId(app.blueprint)));
    let history = $state<string[]>([]);
    let future = $state<string[]>([]);
    let jsonDraft = $state("");
    let jsonError = $state("");

    const validation = $derived(validateBlueprint(blueprint));
    const valid = $derived(validation.ok ? validation.blueprint : null);
    const issues: BlueprintIssue[] = $derived(validation.ok ? [] : validation.issues);
    const selected = $derived.by(() => {
        if (!valid) return null;
        return (selectedId ? findNode(valid.ui, selectedId) : null) ?? valid.ui;
    });
    const title = $derived(appDisplayFromBlueprint(blueprint).title);
    const blueprintJson = $derived(JSON.stringify(blueprint));

    const previewRunner = $derived(
        mode === "preview" && valid ? createRunner({ blueprint: valid }) : null
    );

    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let queued = false;

    const scheduleSave = (): void => {
        saveState = "dirty";
        clearTimeout(timer);
        timer = setTimeout(() => {
            void save();
        }, 800);
    };

    const save = async (force = false): Promise<void> => {
        clearTimeout(timer);
        if (inFlight) {
            queued = true;
            return;
        }
        if (saveState === "conflict") return;
        if (!force && saveState === "saved") return;

        inFlight = true;
        saveState = "saving";
        saveError = "";
        const sent = JSON.stringify(blueprint);
        const expected = revision;

        try {
            const response = await fetch(`/api/apps/${app.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ revision: expected, blueprint })
            });
            const payload = (await response.json().catch(() => ({}))) as {
                app?: AppView;
                message?: string;
                revision?: number;
            };

            if (response.status === 409) {
                saveState = "conflict";
                conflictRevision = typeof payload.revision === "number" ? payload.revision : null;
                return;
            }

            if (!response.ok || !payload.app) {
                saveState = "error";
                saveError = payload.message ?? "Could not save this draft.";
                return;
            }

            revision = payload.app.draftRevision;
            saveState = JSON.stringify(blueprint) === sent ? "saved" : "dirty";
            if (saveState === "dirty") scheduleSave();
        } catch {
            saveState = "error";
            saveError = "Could not reach JEVIL.";
        } finally {
            inFlight = false;
            if (queued) {
                queued = false;
                if (saveState === "dirty") scheduleSave();
            }
        }
    };

    const reload = async (): Promise<void> => {
        try {
            const response = await fetch(`/api/apps/${app.id}`);
            if (!response.ok) return;
            const payload = (await response.json()) as { app: AppView };
            blueprint = payload.app.blueprint;
            revision = payload.app.draftRevision;
            selectedId = rootNodeId(payload.app.blueprint);
            history = [];
            future = [];
            conflictRevision = null;
            saveState = "saved";
        } catch {
            saveState = "error";
            saveError = "Could not reach JEVIL.";
        }
    };

    const mutate = (change: (current: Blueprint) => Blueprint): void => {
        const current = valid;
        if (!current) return;

        history = [...history.slice(-99), JSON.stringify(blueprint)];
        future = [];
        const next = change(current);
        blueprint = next;
        if (!findNode(next.ui, selectedId)) selectedId = next.ui.id;
        scheduleSave();
    };

    const undo = (): void => {
        const previous = history.at(-1);
        if (previous === undefined) return;

        history = history.slice(0, -1);
        future = [JSON.stringify(blueprint), ...future].slice(0, 100);
        blueprint = JSON.parse(previous) as unknown;
        selectedId = rootNodeId(blueprint);
        scheduleSave();
    };

    const redo = (): void => {
        const next = future[0];
        if (next === undefined) return;

        future = future.slice(1);
        history = [...history.slice(-99), JSON.stringify(blueprint)];
        blueprint = JSON.parse(next) as unknown;
        selectedId = rootNodeId(blueprint);
        scheduleSave();
    };

    const addComponent = (type: string): void => {
        const current = valid;
        if (!current) return;

        const target = selected && isContainer(selected.type) ? selected : null;
        const parent = selected ? findParent(current.ui, selected.id)?.parent : null;
        const destination = target ?? (parent && isContainer(parent.type) ? parent : current.ui);

        const id = uniqueNodeId(current.ui, type);
        const node = defaultNode(type, id, current.inputs);
        mutate((value) => insertNode(value, destination.id, node));
        selectedId = id;
        mode = "design";
    };

    const deleteSelected = (id: string): void => {
        const current = valid;
        if (!current || id === current.ui.id) return;

        const parent = findParent(current.ui, id)?.parent ?? current.ui;
        mutate((value) => removeNode(value, id));
        selectedId = parent.id;
    };

    const duplicateSelected = (id: string): void => {
        const current = valid;
        if (!current || id === current.ui.id) return;

        const before = collectNodeIds(current.ui);
        const next = duplicateNode(current, id);
        const added = [...collectNodeIds(next.ui)].find((candidate) => !before.has(candidate));
        mutate(() => next);
        if (added) selectedId = added;
    };

    const moveSelected = (id: string, delta: -1 | 1): void => {
        mutate((value) => moveNode(value, id, delta));
    };

    const setProp = (key: string, propValue: unknown): void => {
        const current = selected;
        if (!current) return;
        mutate((value) =>
            setNodeProp(
                value,
                current.id,
                key,
                propValue === undefined ? undefined : (propValue as PropValue)
            )
        );
    };

    const addInput = (): void => {
        mutate((current) => {
            let attempt = 1;
            while (current.inputs.some((input) => input.id === `input_${attempt}`)) attempt += 1;
            return upsertInput(current, {
                id: `input_${attempt}`,
                type: "text",
                label: "New input",
                default: ""
            });
        });
    };

    const focusIssue = (pointer: string): void => {
        const current = valid;
        if (!current) return;
        const id = nodeIdAtPointer(current.ui, pointer);
        if (id) selectedId = id;
    };

    const openJson = (): void => {
        jsonDraft = JSON.stringify(blueprint, null, 2);
        jsonError = "";
        mode = "json";
    };

    const applyJson = (): void => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonDraft);
        } catch {
            jsonError = m.editor_json_invalid();
            return;
        }

        history = [...history.slice(-99), JSON.stringify(blueprint)];
        future = [];
        blueprint = parsed;
        jsonError = "";
        selectedId = rootNodeId(parsed);
        mode = "design";
        scheduleSave();
    };

    const formatJson = (): void => {
        try {
            jsonDraft = JSON.stringify(JSON.parse(jsonDraft), null, 2);
            jsonError = "";
        } catch {
            jsonError = m.editor_json_invalid();
        }
    };

    const useAnswers = (answers: Record<string, Record<string, Answer>>): void => {
        mutate((current) => setPreviewAnswers(current, answers));
    };

    const saveLabel = $derived(
        saveState === "saved"
            ? m.editor_saved()
            : saveState === "dirty"
              ? m.editor_dirty()
              : saveState === "saving"
                ? m.editor_saving()
                : saveState === "conflict"
                  ? m.editor_conflict()
                  : m.editor_error()
    );

    onMount(() => {
        const onKey = (event: KeyboardEvent): void => {
            const command = event.metaKey || event.ctrlKey;

            if (command && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void save(true);
                return;
            }

            if (command && event.key.toLowerCase() === "z") {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
                return;
            }

            if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                if (!selectedId) return;
                event.preventDefault();
                moveSelected(selectedId, event.key === "ArrowUp" ? -1 : 1);
            }
        };

        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("keydown", onKey);
            clearTimeout(timer);
        };
    });
</script>

<div class="flex min-h-screen flex-col bg-paper">
    <header class="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div class="container-page flex flex-wrap items-center gap-3 py-3">
            <a
                class="text-small font-semibold text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href={resolve("/me?tab=drafts")}>{m.editor_back()}</a
            >
            <span aria-hidden="true" class="text-muted">/</span>
            <div class="min-w-0 flex-1">
                <p class="truncate text-small font-semibold text-ink">{title}</p>
                <p class="truncate font-mono text-micro text-muted">/{app.slug}</p>
            </div>

            <div class="flex items-center gap-1" role="group" aria-label="Editor mode">
                <button
                    type="button"
                    class={mode === "design"
                        ? "rounded-full bg-ink px-3 py-1 text-micro font-semibold text-paper"
                        : "rounded-full px-3 py-1 text-micro font-semibold text-ink-2 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"}
                    onclick={() => (mode = "design")}>{m.editor_design()}</button
                >
                <button
                    type="button"
                    class={mode === "preview"
                        ? "rounded-full bg-ink px-3 py-1 text-micro font-semibold text-paper"
                        : "rounded-full px-3 py-1 text-micro font-semibold text-ink-2 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"}
                    disabled={!valid}
                    onclick={() => (mode = "preview")}>{m.editor_preview()}</button
                >
                <button
                    type="button"
                    class={mode === "json"
                        ? "rounded-full bg-ink px-3 py-1 text-micro font-semibold text-paper"
                        : "rounded-full px-3 py-1 text-micro font-semibold text-ink-2 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"}
                    onclick={openJson}>{m.editor_json()}</button
                >
            </div>

            <div class="flex items-center gap-1">
                <button
                    type="button"
                    class="rounded-sm px-2 py-1 text-micro font-semibold text-ink-2 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
                    disabled={history.length === 0}
                    onclick={undo}>{m.editor_undo()}</button
                >
                <button
                    type="button"
                    class="rounded-sm px-2 py-1 text-micro font-semibold text-ink-2 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
                    disabled={future.length === 0}
                    onclick={redo}>{m.editor_redo()}</button
                >
            </div>

            <span
                class="font-mono text-micro {saveState === 'conflict' || saveState === 'error'
                    ? 'text-red'
                    : saveState === 'dirty'
                      ? 'text-gold'
                      : 'text-muted'}"
                aria-live="polite">{saveLabel}</span
            >
            <Button
                variant="secondary"
                class="min-h-9 px-3 text-[0.8125rem]"
                loading={saveState === "saving"}
                onclick={() => void save(true)}>{m.editor_save()}</Button
            >
        </div>

        {#if saveState === "conflict"}
            <div
                class="container-page flex flex-wrap items-center gap-3 border-t border-red/30 bg-red/10 py-2"
                role="alert"
            >
                <p class="text-small text-ink">
                    {m.editor_conflict()}
                    {conflictRevision ? `Latest revision: ${conflictRevision}.` : ""}
                </p>
                <Button
                    variant="secondary"
                    class="min-h-9 px-3 text-[0.8125rem]"
                    onclick={() => void reload()}
                >
                    {m.editor_conflict_reload()}
                </Button>
            </div>
        {:else if saveState === "error"}
            <div
                class="container-page flex flex-wrap items-center gap-3 border-t border-red/30 bg-red/10 py-2"
                role="alert"
            >
                <p class="text-small text-ink">{saveError || m.editor_error_hint()}</p>
                <Button
                    variant="secondary"
                    class="min-h-9 px-3 text-[0.8125rem]"
                    onclick={() => void save(true)}
                >
                    {m.editor_save()}
                </Button>
            </div>
        {/if}
    </header>

    <main class="container-page flex flex-1 flex-col gap-4 py-4">
        <div class="grid flex-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
            <div class="order-2 lg:order-1">
                <EditorPalette inputs={valid?.inputs ?? []} onadd={addComponent} />
            </div>

            <section class="order-1 flex min-h-0 flex-col gap-3 lg:order-2" aria-label="Canvas">
                {#if mode === "json"}
                    <div class="flex flex-col gap-3 rounded-md border border-line bg-paper p-4">
                        <p class="text-small text-ink-2">{m.editor_json_hint()}</p>
                        <textarea
                            class="min-h-[28rem] w-full rounded-sm border-[1.5px] border-line bg-night p-4 font-mono text-small leading-relaxed text-on-night focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none"
                            bind:value={jsonDraft}
                            spellcheck="false"
                            aria-label="Blueprint JSON"></textarea>
                        {#if jsonError}
                            <p class="text-small text-red">{jsonError}</p>
                        {/if}
                        <div class="flex flex-wrap gap-2">
                            <Button class="min-h-9 px-3 text-[0.8125rem]" onclick={applyJson}>
                                {m.editor_json_apply()}
                            </Button>
                            <Button
                                variant="secondary"
                                class="min-h-9 px-3 text-[0.8125rem]"
                                onclick={formatJson}
                            >
                                {m.editor_format()}
                            </Button>
                        </div>
                    </div>
                {:else if mode === "preview"}
                    {#if valid && previewRunner}
                        <div class="rounded-md border border-line bg-paper-2/40 p-4">
                            <div inert>
                                {#key blueprintJson}
                                    <RuntimeApp
                                        blueprint={valid}
                                        runner={previewRunner}
                                        showStatus={false}
                                    />
                                {/key}
                            </div>
                        </div>
                    {:else}
                        <p class="text-small text-muted">{m.editor_no_issues()}</p>
                    {/if}
                {:else}
                    {#if issues.length > 0}
                        <div
                            class="flex flex-col gap-2 rounded-md border border-red/30 bg-red/5 p-4"
                        >
                            <p class="text-small font-semibold text-ink">
                                {issues.length} problem{issues.length === 1 ? "" : "s"} to fix before
                                preview.
                            </p>
                            <ul class="flex flex-col gap-1">
                                {#each issues.slice(0, 6) as issue, index (index)}
                                    <li class="font-mono text-micro text-red">
                                        {issue.pointer || "/"}: {issue.message}
                                    </li>
                                {/each}
                            </ul>
                            {#if issues.length > 6}
                                <p class="text-micro text-muted">
                                    {issues.length - 6} more in the inspector.
                                </p>
                            {/if}
                            <div>
                                <Button
                                    variant="secondary"
                                    class="min-h-9 px-3 text-[0.8125rem]"
                                    onclick={openJson}
                                >
                                    {m.editor_json()}
                                </Button>
                            </div>
                        </div>
                    {/if}

                    <div
                        class="min-h-[28rem] rounded-md border border-line bg-paper [background-image:radial-gradient(circle,var(--color-line)_1px,transparent_1px)] [background-size:16px_16px] p-4"
                    >
                        {#if valid}
                            <EditorStructure
                                blueprint={valid}
                                {selectedId}
                                onselect={(id) => (selectedId = id)}
                                onmove={moveSelected}
                                onduplicate={duplicateSelected}
                                ondelete={deleteSelected}
                            />
                        {:else}
                            <p class="text-small text-muted">{m.editor_no_selection()}</p>
                        {/if}
                    </div>
                {/if}
            </section>

            <div class="order-3">
                {#if valid}
                    <EditorInspector
                        blueprint={valid}
                        {selected}
                        {issues}
                        onprop={(key, value) => setProp(key, value)}
                        onmeta={(patch) => mutate((current) => setMeta(current, patch))}
                        oninput={(input) => mutate((current) => upsertInput(current, input))}
                        onremoveinput={(id) => mutate((current) => removeInput(current, id))}
                        onaddinput={addInput}
                        onissue={focusIssue}
                    />
                {:else}
                    <p class="text-small text-muted">
                        Fix the problems above, or use Edit JSON, to unlock the inspector.
                    </p>
                {/if}
            </div>
        </div>

        <EditorTestBench blueprint={valid} {connections} onuseanswers={useAnswers} />
    </main>
</div>
