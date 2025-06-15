import i18n from 'i18next';
import Backend from 'i18next-http-backend';

import { getLang } from './locale_service';

i18n
  .use(Backend)
  .init({
    lng: getLang(),
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/mop/assets/locales/{{lng}}.json',
    },
  });

export default i18n;
