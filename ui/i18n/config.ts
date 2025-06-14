import i18n from 'i18next';

import en from '../../assets/locales/en.json';
import { getLang } from './locale_service';

// eslint-disable-next-line import/no-named-as-default-member
i18n.init({
  lng: getLang(),
  fallbackLng: 'en',
  debug: process.env.NODE_ENV === 'development',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: en
    },
  }
});

export default i18n;