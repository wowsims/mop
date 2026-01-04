// Locale service for WoWSims
// Single source of truth for language settings

const STORAGE_KEY = 'lang';

export const supportedLanguages: Record<string, string> = {
	'en': 'English',
	'fr': 'Français',
	'zh_cn': '中文(简体)',
};

export const getLang = (): string => {
	const storedLang = localStorage.getItem(STORAGE_KEY);
	if (storedLang && storedLang in supportedLanguages) {
		return storedLang;
	}
	return setLang('en');
};

export const setLang = (lang: string): string => {
	if (lang in supportedLanguages) {
		localStorage.setItem(STORAGE_KEY, lang);
		document.documentElement.lang = lang;
		if (window.i18next) {
			window.i18next.changeLanguage(lang);
		}
	}
	return lang;
};

// Add TypeScript interface for i18next on window
declare global {
	interface Window {
		i18next: {
			changeLanguage: (lang: string) => Promise<unknown>;
		};
	}
}
