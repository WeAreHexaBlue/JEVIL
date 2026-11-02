import { browser } from '$app/env';

export type ThemeChoice = 'light' | 'system' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'jevil-theme';

const THEME_COLORS: Record<ResolvedTheme, string> = {
	light: '#f7f4ff',
	dark: '#120e19'
};

const isChoice = (value: unknown): value is ThemeChoice =>
	value === 'light' || value === 'dark' || value === 'system';

/**
 * Client-side theme preference.
 *
 * The initial paint is handled by the inline script in app.html so there is no
 * flash of the wrong theme. `init()` only syncs the reactive state and the
 * `<meta name="theme-color">` tag after hydration.
 */
class ThemeController {
	choice = $state<ThemeChoice>('system');
	systemDark = $state(false);
	initialized = false;
	media: MediaQueryList | null = null;

	get resolved(): ResolvedTheme {
		if (this.choice === 'system') return this.systemDark ? 'dark' : 'light';
		return this.choice;
	}

	init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		const stored = localStorage.getItem(STORAGE_KEY);
		this.choice = isChoice(stored) ? stored : 'system';

		this.media = window.matchMedia('(prefers-color-scheme: dark)');
		this.systemDark = this.media.matches;
		this.media.addEventListener('change', (event) => {
			this.systemDark = event.matches;
			this.apply();
		});

		this.apply();
	}

	set(next: ThemeChoice) {
		this.choice = next;
		if (browser) localStorage.setItem(STORAGE_KEY, next);
		this.apply();
	}

	apply() {
		if (!browser) return;

		const root = document.documentElement;
		const resolved = this.resolved;

		root.dataset.theme = resolved;
		root.dataset.themeChoice = this.choice;
		root.style.colorScheme = resolved;

		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', THEME_COLORS[resolved]);
	}
}

export const theme = new ThemeController();
