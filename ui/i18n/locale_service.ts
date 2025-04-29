// Locale service for WoWSims
// Single source of truth for language settings

const STORAGE_KEY = 'lang';

export const supportedLanguages: Record<string, string> = {
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
	const storedLang = localStorage.getItem(STORAGE_KEY);
	if (storedLang && storedLang in supportedLanguages) {
		return storedLang;
	}
	setLanguageCode('en');
	return 'en';
}

export function setLanguageCode(lang: string) {
	localStorage.setItem(STORAGE_KEY, lang);
	document.documentElement.lang = lang;
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