import i18n from './config';
import { getCurrentLang, setLanguageCode } from './locale_service';

// Elements that need translation
const TRANSLATION_KEYS = {
  'title': 'home.title',
  'description': 'home.description',
  'start-simulation': 'home.startSimulation',
  'browse-simulations': 'home.browseSimulations',
  'documentation': 'home.documentation',
  'github': 'home.github'
};

// Function to translate class names
function translateClass(className: string): string {
  return i18n.t(`classes.${className.toLowerCase().replace(/ /g, '_')}`);
}

// Function to translate spec names
function translateSpec(className: string, specName: string): string {
  return i18n.t(`specs.${className.toLowerCase()}.${specName.toLowerCase().replace(/ /g, '_')}`);
}

// Function to extract class and spec names from a link
function extractClassAndSpecFromLink(link: HTMLAnchorElement): { className?: string; specName?: string } {
  const parts = link.pathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return {
      className: parts[1],
      specName: parts[2]
    };
  }
  return {};
}

function updateTranslations() {
  // Set HTML lang attribute
  document.documentElement.lang = getCurrentLang();

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      element.textContent = i18n.t(key);
    }
  });

  // For each sim-link-content, translate class and spec names
  document.querySelectorAll('.sim-link-content').forEach(content => {
    const classLabel = content.querySelector('.sim-link-label');
    const specTitle = content.querySelector('.sim-link-title');
    const link = content.closest('a');

    if (classLabel && specTitle && link instanceof HTMLAnchorElement) {
      // Submenu: both class and spec present
      const info = extractClassAndSpecFromLink(link);
      if (info && info.className && info.specName) {
        classLabel.textContent = translateClass(info.className);
        specTitle.textContent = translateSpec(info.className, info.specName);
      }
    } else if (specTitle && link instanceof HTMLAnchorElement) {
      // Main menu: only a title, treat as class
      const info = extractClassAndSpecFromLink(link);
      if (info && info.className) {
        specTitle.textContent = translateClass(info.className);
      }
    }
  });
}

function localizeHomePage() {
  // Initialize i18n if not already initialized
  if (!i18n.isInitialized) {
    i18n.init();
  }

  // Handle language selector
  document.querySelectorAll('[data-lang]').forEach(element => {
    element.addEventListener('click', e => {
      e.preventDefault();
      getCurrentLang();
      window.location.reload();
    });
  });

  // Update translations when language changes
  i18n.on('languageChanged', () => {
    updateTranslations();
  });

  // Initial translation
  updateTranslations();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', localizeHomePage);
} else {
  localizeHomePage();
}

export default localizeHomePage;
