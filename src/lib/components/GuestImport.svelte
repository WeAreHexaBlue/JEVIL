<script lang="ts">
    import { onMount } from "svelte";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import { errorClass } from "#lib/components/field-styles";
    import {
        deleteGuestConnection,
        isGuestStoreAvailable,
        listGuestConnections
    } from "#lib/connections/guest-store";
    import type { GuestConnection } from "#lib/schema/guest";

    let connections = $state<GuestConnection[]>([]);
    let dismissed = $state(false);
    let busy = $state(false);
    let error = $state<string | null>(null);
    let imported = $state<string | null>(null);

    const cloud = $derived(connections.filter((connection) => connection.mode === "cloud"));

    onMount(async () => {
        if (!isGuestStoreAvailable()) return;
        try {
            connections = await listGuestConnections();
        } catch {
            connections = [];
        }
    });

    async function importAll() {
        if (cloud.length === 0) return;

        busy = true;
        error = null;
        imported = null;

        const body = new FormData();
        body.set("connections", JSON.stringify(cloud));

        try {
            const response = await fetch("?/import", {
                method: "POST",
                body,
                headers: { "x-sveltekit-action": "true" }
            });

            const payload = (await response.json()) as {
                type?: string;
                data?: { imported?: number; skipped?: number; ids?: string[]; error?: string };
            };

            if (payload.type !== "success" || !payload.data) {
                error = payload.data?.error ?? m.connections_import_failed();
                return;
            }

            const { imported: count = 0, skipped = 0, ids = [] } = payload.data;

            for (const id of ids) {
                try {
                    await deleteGuestConnection(id);
                } catch {
                    // The account copy exists; a stuck browser row must not
                    // turn a successful import into an error.
                }
            }

            connections = await listGuestConnections();
            imported =
                skipped > 0
                    ? `${m.connections_import_done({ count: String(count) })} ${m.connections_import_skipped({ count: String(skipped) })}`
                    : m.connections_import_done({ count: String(count) });
        } catch {
            error = m.connections_import_failed();
        } finally {
            busy = false;
        }
    }
</script>

{#if !dismissed && cloud.length > 0}
    <div class="mt-6 rounded-lg border border-brand/40 bg-brand-soft p-5" role="status">
        <h2 class="text-h3">{m.connections_import_title({ count: String(cloud.length) })}</h2>
        <p class="mt-1 max-w-2xl text-small text-ink-2">{m.connections_import_body()}</p>

        {#if error}
            <p class="{errorClass} mt-3" role="alert">{error}</p>
        {/if}
        {#if imported}
            <p class="mt-3 text-small font-semibold text-ink" role="status">{imported}</p>
        {/if}

        <div class="mt-4 flex flex-wrap gap-2">
            <Button onclick={importAll} loading={busy} disabled={busy || cloud.length === 0}>
                {m.connections_import_action()}
            </Button>
            <Button variant="ghost" onclick={() => (dismissed = true)}>
                {m.connections_import_dismiss()}
            </Button>
        </div>
    </div>
{/if}
