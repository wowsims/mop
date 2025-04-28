import i18n from './config';
import { getLanguageCode } from './language_service';

// Elements that need translation
const TRANSLATION_KEYS = {
  'title': 'home.title',
  'description': 'home.description',
  'start-simulation': 'home.startSimulation',
  'browse-simulations': 'home.browseSimulations',
  'documentation': 'home.documentation',
  'github': 'home.github'
};

export function localizeHomePage() {
  // Wait for i18n to be ready
  i18n.on('initialized', () => {
    // Update all elements with translations
    Object.entries(TRANSLATION_KEYS).forEach(([elementId, translationKey]) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.textContent = i18n.t(translationKey);
      }
    });
  });
}

// Initialize localization when the script loads
localizeHomePage();
