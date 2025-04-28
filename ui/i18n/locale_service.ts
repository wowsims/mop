// Locale service for WoWSims
// Single source of truth for language settings

const STORAGE_KEY = 'lang';

export const wowheadSupportedLanguages: Record<string, string> = {
	'en': 'English',
	'cn': '简体中文',
	'de': 'Deutsch',
	'es': 'Español',
	'fr': 'Français',
	'it': 'Italiano',
	'ko': '한국어',
	'pt': 'Português Brasileiro',
	'ru': 'Русский',
};

export function getCurrentLang(): string {
	const lang = localStorage.getItem(STORAGE_KEY);
	return lang || 'en';
}

export function setLanguageCode(lang: string) {
	// Store the language code directly
	localStorage.setItem(STORAGE_KEY, lang);

	// Update HTML lang attribute
	document.documentElement.lang = lang;

	// Force i18next to use our language setting
	// This is needed because i18next maintains its own storage
	if (window.i18next) {
		window.i18next.changeLanguage(lang);
	}
}

export function getWowheadLanguagePrefix(): string {
	const lang = getCurrentLang();
	return lang === 'en' ? '' : `${lang}/`;
}

// Add TypeScript interface for i18next on window
declare global {
	interface Window {
		i18next: {
			changeLanguage: (lang: string) => Promise<unknown>;
		};
	}
}