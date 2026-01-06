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

export const getLangId = (): number => {
	const storedLang = localStorage.getItem(STORAGE_KEY);
	if (storedLang && storedLang in supportedLanguages) {
        // Map language codes to numeric Ids, refer to Wowhead locale Ids
		switch(storedLang) {
			case 'ko': return 1;
			case 'fr': return 2;
			case 'de': return 3;
			case 'cn': return 4;
			case 'es': return 6;
			case 'ru': return 7;
			case 'pt': return 8;
			case 'it': return 9;
			case 'tw': return 10;
			case 'mx': return 11;
			default: return 0;
		};
	}
	return 0;
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
