import { getCurrentLang } from '../core/locale_service';

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

export function getLanguageCode(): string {
	return getCurrentLang();
}

export function getWowheadLanguagePrefix(): string {
	const lang = getCurrentLang();
	return lang === 'en' ? '' : `${lang}/`;
}

export function setLanguageCode(lang: string) {
	localStorage.setItem('lang', lang);
}
