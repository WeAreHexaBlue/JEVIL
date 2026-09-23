<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "$lib/paraglide/messages";

    import logo from "$lib/assets/jevil.svg";

    let menuOpen = $state(false);

    function toggleMenu() { menuOpen = !menuOpen; }

	function closeMenu() { menuOpen = false; }

	function handleKeydown(e: KeyboardEvent) { if (e.key === "Escape") closeMenu(); }

	function handleResize() { if (window.innerWidth >= 1280) closeMenu(); }
</script>

{#snippet brand()}
    <a href={resolve("/")} class="brand" onclick={closeMenu}>
		<img src={logo} class="size-10 sm:size-16" alt="JEVIL Logo" />
        <h1 class="title">{m.evil()}</h1>
	</a>
{/snippet}

{#snippet links(vertical = false)}
    <span class="links" class:vertical>
        <a href={resolve("/")}>Create</a>
    </span>
{/snippet}

<nav class="nav">
    <div class="bar">
        <span class="main">
            {@render brand()}
            <span class="desktop-only">
                {@render links(false)}
            </span>
        </span>
    </div>
</nav>

<style lang="postcss">
	@reference "../../base.css";

	.nav {
		@apply fixed inset-x-0 z-50 mx-auto;
		@apply border-b;
		@apply flex flex-col items-stretch gap-2;
		@apply bg-violet-900 bg-radial-[ellipse_55%_110%_at_50%_100%] from-jlime to-70%;

        border-image: linear-gradient(to right, transparent, var(--color-jlime), transparent) 1;
	}

    .bar {
		@apply flex w-full items-center justify-center gap-2;
	}

    .nav .main {
        @apply flex items-center gap-8;
    }

    .links {
        @apply flex items-center gap-6;
        @apply text-2xl font-clash font-semibold;

        :hover {
            @apply underline;
        }
    }

    .desktop-only {
		@apply hidden xl:flex items-center;
	}
</style>