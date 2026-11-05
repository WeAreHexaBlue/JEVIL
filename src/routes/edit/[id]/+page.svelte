<script lang="ts">
    import EditorShell from "#lib/editor/EditorShell.svelte";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
</script>

<svelte:head>
    <title>{data.app.title} — Editor — JEVIL</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<EditorShell app={data.app} connections={data.connections} />
