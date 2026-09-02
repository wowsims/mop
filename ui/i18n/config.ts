import i18n, { Resource } from 'i18next';
import resources from 'virtual:i18next-loader';

import { getLang } from './locale_service';

// eslint-disable-next-line import/no-named-as-default-member
i18n.init({
	lng: getLang(),
	fallbackLng: 'en',
	debug: process.env.NODE_ENV === 'development',
	interpolation: {
		escapeValue: false,
	},
	resources: Object.keys(resources).reduce<Resource>((acc, lang) => {
		acc[lang] = resources[lang];
		return acc;
	}, {}),
});

export default i18n;
