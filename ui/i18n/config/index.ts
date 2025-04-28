import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

import { getLanguageCode } from '../lang';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .init({
    lng: getLanguageCode(),
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/mop/assets/locales/{{lng}}/{{ns}}.json',
    },
    ns: ['common'],
    defaultNS: 'common',
  });

export default i18n;
