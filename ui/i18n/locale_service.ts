// Locale service for WoWSims
// Single source of truth for language settings

const STORAGE_KEY = 'lang';

export const supportedLanguages: Record<string, string> = {
	en: 'English',
	fr: 'Français',
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
	}
	return lang;
};
