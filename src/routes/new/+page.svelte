<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>{m.new_title()} — JEVIL</title>
</svelte:head>

<section
	class="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center md:items-start md:text-left"
>
	<p class="eyebrow">{m.nav_make()}</p>
	<h1 class="mt-4 max-w-2xl text-h1">{m.new_title()}</h1>
	<p class="measure mt-4 text-body-lg text-ink-2">{m.new_body()}</p>
	<div class="mt-8">
		<Button href={resolve('/apps')}>
			{m.new_cta()}
			<Icon name="arrow-right" size={18} />
		</Button>
	</div>
</section>
