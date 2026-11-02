<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import AuthLayout from '#lib/components/AuthLayout.svelte';
	import Button from '#lib/components/Button.svelte';
	import { errorClass, inputClass, labelClass } from '#lib/components/field-styles';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{m.auth_sign_up_title()} — JEVIL</title>
	<meta name="description" content={m.auth_sub()} />
</svelte:head>

<AuthLayout title={m.auth_sign_up_title()} providers={data.providers}>
	<form method="POST" action="?/email" class="flex flex-col gap-4">
		{#if form?.error}
			<p class={errorClass} role="alert">{form.error}</p>
		{/if}

		<div class="flex flex-col gap-1.5">
			<label for="name" class={labelClass}>{m.auth_name()}</label>
			<input
				id="name"
				name="name"
				type="text"
				autocomplete="name"
				required
				maxlength="60"
				value={form?.name ?? ''}
				class={inputClass}
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="email" class={labelClass}>{m.auth_email()}</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
				class={inputClass}
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="password" class={labelClass}>{m.auth_password()}</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength="8"
				aria-describedby="password-hint"
				class={inputClass}
			/>
			<p id="password-hint" class="text-micro text-muted">{m.auth_password_hint()}</p>
		</div>

		<Button type="submit" fullWidth class="mt-2">{m.auth_submit_sign_up()}</Button>
	</form>

	<p class="mt-6 text-small text-muted">
		{m.auth_have_account()}
		<a
			href={resolve('/sign-in')}
			class="font-semibold text-brand underline underline-offset-4 hover:text-ink"
		>
			{m.auth_to_sign_in()}
		</a>
	</p>
</AuthLayout>
